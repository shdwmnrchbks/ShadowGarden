import test from 'node:test';
import assert from 'node:assert/strict';
import { installEpubLifecyclePatch } from '../../src/assets/js/reader/epub-lifecycle.js';

function eventTarget(){
  const listeners=new Map();
  return{
    listeners,
    addEventListener(type,listener){
      if(!listeners.has(type))listeners.set(type,new Set());
      listeners.get(type).add(listener);
    },
    removeEventListener(type,listener){listeners.get(type)?.delete(listener)},
    count(type){return listeners.get(type)?.size||0}
  };
}

function hookList(){
  const hooks=[];
  return{
    register(...items){hooks.push(...items)},
    deregister(item){const index=hooks.indexOf(item);if(index>=0)hooks.splice(index,1)},
    list(){return hooks}
  };
}

function viewList(){
  const views=[];
  return{
    add(view){views.push(view);return view},
    remove(view){const index=views.indexOf(view);if(index>=0)views.splice(index,1)},
    all(){return views},
    clear(){views.splice(0)}
  };
}

function section(name){
  return{
    name,
    unloadCount:0,
    unload(){this.unloadCount+=1}
  };
}

test('EPUB.js lifecycle compatibility patch releases Default and Continuous manager ownership',()=>{
  const previousWindow=globalThis.window;
  const fakeWindow=eventTarget();
  globalThis.window=fakeWindow;

  try{
    const scroller=eventTarget();

    class Manager{
      constructor(){
        this.settings={fullsize:false,snap:false};
        this.container=scroller;
        this.stage={orientationChangeFunc:()=>{}};
        this.views=viewList();
        fakeWindow.addEventListener('orientationchange',this.stage.orientationChangeFunc);
        this.destroyed=false;
      }
      onScroll(){}
      addEventListeners(){throw new Error('unpatched Default addEventListeners called')}
      removeEventListeners(){throw new Error('unpatched Default removeEventListeners called')}
      destroy(){this.views.clear();this.removeEventListeners();this.destroyed=true}
    }

    class ContinuousManager extends Manager{
      constructor(){
        super();
        this.isPaginated=false;
        this.scrollSetupCount=0;
      }
      addScrollListeners(){
        this.scrollSetupCount+=1;
        this._onScroll=this.onScroll.bind(this);
        this.container.addEventListener('scroll',this._onScroll);
        this._scrolled=()=>{};
      }
      addEventListeners(){throw new Error('unpatched Continuous addEventListeners called')}
      removeEventListeners(){throw new Error('unpatched Continuous removeEventListeners called')}
      erase(view){this.views.remove(view)}
    }

    class Rendition{
      constructor(book,options={}){
        this.book=book;
        this.book.spine.hooks.content.register(this.injectIdentifier.bind(this));
        const ManagerClass=this.requireManager(options.manager||'default');
        this.manager=new ManagerClass();
        this.manager.addEventListeners();
        this.destroyed=false;
      }
      injectIdentifier(){}
      requireManager(manager){return manager==='continuous'?ContinuousManager:Manager}
      destroy(){this.manager.destroy();this.book=undefined;this.destroyed=true}
    }

    class Book{
      constructor(){this.spine={hooks:{content:hookList()}}}
      renderTo(_viewer,options={}){this.rendition=new Rendition(this,options);return this.rendition}
    }

    // EPUB.js 0.3.93's browser bundle exposes only the coarse "0.3" API version.
    const epub={VERSION:'0.3',Rendition,Book};

    assert.equal(installEpubLifecyclePatch(epub),true);
    assert.equal(installEpubLifecyclePatch(epub),true,'installation should be idempotent');

    const book=new Book();
    const defaultRendition=book.renderTo('viewer',{manager:'default'});
    const defaultSection=section('default');
    defaultRendition.manager.views.add({section:defaultSection});

    assert.equal(book.spine.hooks.content.list().length,1,'Default rendition hook should be visible while live');
    assert.equal(fakeWindow.count('unload'),1);
    assert.equal(fakeWindow.count('orientationchange'),1);
    assert.equal(scroller.count('scroll'),1);

    defaultRendition.destroy();

    assert.equal(defaultRendition.destroyed,true);
    assert.equal(defaultSection.unloadCount,1,'destroy should release source DOM cached by the destroyed Default view');
    assert.equal(book.spine.hooks.content.list().length,0,'Default destroy should release its book hook');
    assert.equal(fakeWindow.count('unload'),0);
    assert.equal(fakeWindow.count('orientationchange'),0);
    assert.equal(scroller.count('scroll'),0);

    // Default is deliberately exercised first. Continuous inherits from Default, so this
    // catches the inherited patch-marker bug that previously suppressed its own leak fix.
    const continuousRendition=book.renderTo('viewer',{manager:'continuous'});

    assert.equal(book.spine.hooks.content.list().length,1,'Continuous rendition hook should be visible while live');
    assert.equal(continuousRendition.manager.scrollSetupCount,1,'Continuous native scroll setup must be preserved');
    assert.equal(typeof continuousRendition.manager._scrolled,'function','Continuous debounce path must remain installed');
    assert.equal(fakeWindow.count('unload'),1);
    assert.equal(fakeWindow.count('orientationchange'),1);
    assert.equal(scroller.count('scroll'),1);

    const sharedSection=section('shared');
    const firstView={section:sharedSection};
    const secondView={section:sharedSection};
    continuousRendition.manager.views.add(firstView);
    continuousRendition.manager.views.add(secondView);

    continuousRendition.manager.erase(firstView);
    assert.equal(sharedSection.unloadCount,0,'trim must retain a section cache while another live view still uses it');
    continuousRendition.manager.erase(secondView);
    assert.equal(sharedSection.unloadCount,1,'trim should release a section cache after its final live view is removed');

    const remainingSection=section('remaining');
    continuousRendition.manager.views.add({section:remainingSection});
    continuousRendition.destroy();

    assert.equal(continuousRendition.destroyed,true);
    assert.equal(remainingSection.unloadCount,1,'Continuous teardown should release remaining section source DOM through Default destroy');
    assert.equal(sharedSection.unloadCount,1,'already-trimmed sections must not be unloaded twice by rendition teardown');
    assert.equal(book.spine.hooks.content.list().length,0,'Continuous destroy should release its book hook');
    assert.equal(fakeWindow.count('unload'),0);
    assert.equal(fakeWindow.count('orientationchange'),0);
    assert.equal(scroller.count('scroll'),0);
  }finally{
    if(previousWindow===undefined)delete globalThis.window;
    else globalThis.window=previousWindow;
  }
});

test('EPUB.js lifecycle compatibility patch rejects an incompatible runtime API version',()=>{
  class Rendition{requireManager(){return class Manager{}}}
  class Book{renderTo(){return{}}}
  assert.equal(installEpubLifecyclePatch({VERSION:'0.4',Rendition,Book}),false);
});
