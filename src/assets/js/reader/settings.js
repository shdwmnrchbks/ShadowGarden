/* Shadow Garden R4 — canonical Reader settings/UI owner. */
const clamp=(value,min,max)=>Math.min(max,Math.max(min,Number(value)||min));

export const READER_TYPOGRAPHY_PRESETS={
  publication:{font:"book",fontSize:100,lineHeight:1.6,paragraphSpacing:"publication",width:760},
  compact:{font:"book",fontSize:95,lineHeight:1.45,paragraphSpacing:"tight",width:820},
  comfortable:{font:"book",fontSize:105,lineHeight:1.7,paragraphSpacing:"comfortable",width:760},
  spacious:{font:"book",fontSize:110,lineHeight:1.85,paragraphSpacing:"spacious",width:700}
};

export const READER_DEFAULTS={theme:"garden",...READER_TYPOGRAPHY_PRESETS.publication,typographyPreset:"publication",flow:"paginated",swipeTurns:true};

const TYPOGRAPHY_KEYS=["font","fontSize","lineHeight","paragraphSpacing","width"];
const TYPOGRAPHY_PRESET_NAMES=Object.keys(READER_TYPOGRAPHY_PRESETS);
const PARAGRAPH_SPACING_NAMES=["publication","tight","comfortable","spacious"];

function matchesTypography(settings,preset){
  return TYPOGRAPHY_KEYS.every(key=>settings[key]===preset[key]);
}

function inferredTypographyPreset(settings){
  return TYPOGRAPHY_PRESET_NAMES.find(name=>matchesTypography(settings,READER_TYPOGRAPHY_PRESETS[name]))||"custom";
}

export function sanitizeReaderSettings(value){
  const input=value||{};
  const settings={
    theme:["garden","night","black","paper"].includes(input.theme)?input.theme:READER_DEFAULTS.theme,
    font:["book","system","classic"].includes(input.font)?input.font:READER_DEFAULTS.font,
    fontSize:clamp(input.fontSize??READER_DEFAULTS.fontSize,75,160),
    lineHeight:clamp(input.lineHeight??READER_DEFAULTS.lineHeight,1.25,2.1),
    paragraphSpacing:PARAGRAPH_SPACING_NAMES.includes(input.paragraphSpacing)?input.paragraphSpacing:READER_DEFAULTS.paragraphSpacing,
    width:clamp(input.width??READER_DEFAULTS.width,560,1050),
    flow:["paginated","scrolled-doc"].includes(input.flow)?input.flow:READER_DEFAULTS.flow,
    swipeTurns:input.swipeTurns!==false
  };
  const requested=[...TYPOGRAPHY_PRESET_NAMES,"custom"].includes(input.typographyPreset)?input.typographyPreset:"";
  const inferred=inferredTypographyPreset(settings);
  settings.typographyPreset=requested&&requested!=="custom"&&matchesTypography(settings,READER_TYPOGRAPHY_PRESETS[requested])?requested:inferred;
  return settings;
}

export function createSettingsController({storage,elements,isAdult=false,onApply,onFlowChange,onReset}={}){
  let settings=sanitizeReaderSettings(storage.loadSettings(READER_DEFAULTS));

  function syncBody(){
    document.body.classList.remove("reader-theme-garden","reader-theme-night","reader-theme-black","reader-theme-paper");
    document.body.classList.add(`reader-theme-${settings.theme}`);
    document.body.classList.toggle("adult-reader",Boolean(isAdult));
    const scrolled=settings.flow==="scrolled-doc";
    document.body.classList.toggle("reader-flow-scrolled",scrolled);document.body.classList.toggle("reader-flow-paginated",!scrolled);
  }
  function syncControls(){
    if(elements.themeSelect)elements.themeSelect.value=settings.theme;
    if(elements.typographyPresetSelect)elements.typographyPresetSelect.value=settings.typographyPreset;
    if(elements.fontSelect)elements.fontSelect.value=settings.font;
    if(elements.fontSizeRange)elements.fontSizeRange.value=settings.fontSize;
    if(elements.fontSizeValue)elements.fontSizeValue.textContent=`${settings.fontSize}%`;
    if(elements.lineHeightRange)elements.lineHeightRange.value=settings.lineHeight;
    if(elements.lineHeightValue)elements.lineHeightValue.textContent=String(settings.lineHeight);
    if(elements.paragraphSpacingSelect)elements.paragraphSpacingSelect.value=settings.paragraphSpacing;
    if(elements.widthRange)elements.widthRange.value=settings.width;
    if(elements.widthValue)elements.widthValue.textContent=`${settings.width}px`;
    if(elements.flowSelect)elements.flowSelect.value=settings.flow;
    if(elements.swipeTurnsToggle)elements.swipeTurnsToggle.checked=settings.swipeTurns!==false;
    if(elements.textWidthSetting)elements.textWidthSetting.hidden=settings.flow!=="scrolled-doc";
  }
  function persist(){settings=sanitizeReaderSettings(settings);storage.saveSettings(settings);syncBody();syncControls();return settings}
  function markTypographyCustom(){settings.typographyPreset="custom"}
  function applyTypographyPreset(name){
    const preset=READER_TYPOGRAPHY_PRESETS[name];
    if(!preset)return false;
    settings={...settings,...preset,typographyPreset:name};
    persist();
    return true;
  }
  function setFlow(flow,{save=true}={}){settings.flow=flow==="scrolled-doc"?"scrolled-doc":"paginated";if(save)persist();else{syncBody();syncControls()}return settings.flow}
  function replace(next,{save=true}={}){settings=sanitizeReaderSettings(next);if(save)persist();else{syncBody();syncControls()}return settings}

  elements.themeSelect?.addEventListener("change",event=>{settings.theme=event.target.value;persist();onApply?.({relayout:false,rebuildPageMap:false})});
  elements.typographyPresetSelect?.addEventListener("change",event=>{if(applyTypographyPreset(event.target.value))onApply?.({relayout:true,rebuildPageMap:true})});
  elements.fontSelect?.addEventListener("change",event=>{settings.font=event.target.value;markTypographyCustom();persist();onApply?.({relayout:true,rebuildPageMap:true})});
  elements.fontSizeRange?.addEventListener("input",event=>{settings.fontSize=Number(event.target.value);markTypographyCustom();persist();onApply?.({relayout:true,rebuildPageMap:true})});
  elements.lineHeightRange?.addEventListener("input",event=>{settings.lineHeight=Number(event.target.value);markTypographyCustom();persist();onApply?.({relayout:true,rebuildPageMap:true})});
  elements.paragraphSpacingSelect?.addEventListener("change",event=>{settings.paragraphSpacing=event.target.value;markTypographyCustom();persist();onApply?.({relayout:true,rebuildPageMap:true})});
  elements.widthRange?.addEventListener("input",event=>{settings.width=Number(event.target.value);markTypographyCustom();persist();onApply?.({relayout:settings.flow==="scrolled-doc",rebuildPageMap:true})});
  elements.swipeTurnsToggle?.addEventListener("change",event=>{settings.swipeTurns=event.target.checked;persist()});
  elements.flowSelect?.addEventListener("change",event=>onFlowChange?.(event.target.value));
  elements.resetReader?.addEventListener("click",()=>{const previous=settings.flow;settings={...READER_DEFAULTS};persist();onReset?.(previous)});

  persist();
  return{get:()=>settings,persist,setFlow,replace,applyTypographyPreset,sync:()=>{syncBody();syncControls()}};
}
