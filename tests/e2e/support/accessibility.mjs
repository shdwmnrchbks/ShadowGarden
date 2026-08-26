import { expect } from '@playwright/test';

export async function accessibilityIssues(page, rootSelector = 'body') {
  return page.locator(rootSelector).evaluate(root => {
    const issues = [];
    const visible = element => {
      if (!(element instanceof Element)) return false;
      if (element.closest('[aria-hidden="true"]')) return false;
      const style = getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) !== 0 && element.getClientRects().length > 0;
    };
    const labelledByText = element => String(element.getAttribute('aria-labelledby') || '')
      .split(/\s+/)
      .filter(Boolean)
      .map(id => document.getElementById(id)?.textContent || '')
      .join(' ')
      .trim();
    const accessibleName = element => {
      const aria = String(element.getAttribute('aria-label') || '').trim();
      if (aria) return aria;
      const labelled = labelledByText(element);
      if (labelled) return labelled;
      const labels = element.labels ? Array.from(element.labels).map(label => label.textContent || '').join(' ').trim() : '';
      if (labels) return labels;
      const title = String(element.getAttribute('title') || '').trim();
      if (title) return title;
      const alt = String(element.getAttribute('alt') || '').trim();
      if (alt) return alt;
      return String(element.textContent || '').replace(/\s+/g, ' ').trim();
    };
    const describe = element => {
      const id = element.id ? `#${element.id}` : '';
      const cls = typeof element.className === 'string' && element.className.trim()
        ? `.${element.className.trim().split(/\s+/).slice(0, 2).join('.')}`
        : '';
      return `${element.tagName.toLowerCase()}${id}${cls}`;
    };

    const interactive = root.querySelectorAll('button,a[href],input:not([type="hidden"]),select,textarea,[role="button"],[role="slider"],[tabindex]:not([tabindex="-1"])');
    interactive.forEach(element => {
      if (!visible(element) || element.matches(':disabled')) return;
      if (!accessibleName(element)) issues.push(`${describe(element)} has no accessible name`);
    });

    root.querySelectorAll('img').forEach(image => {
      if (!visible(image)) return;
      if (!image.hasAttribute('alt')) issues.push(`${describe(image)} is missing alt text`);
    });

    root.querySelectorAll('dialog,[role="dialog"],[role="alertdialog"]').forEach(dialog => {
      if (!visible(dialog)) return;
      if (!accessibleName(dialog)) issues.push(`${describe(dialog)} has no accessible dialog name`);
    });

    const ids = new Map();
    root.querySelectorAll('[id]').forEach(element => {
      const id = String(element.id || '');
      if (!id) return;
      ids.set(id, (ids.get(id) || 0) + 1);
    });
    ids.forEach((count, id) => {
      if (count > 1) issues.push(`#${id} is duplicated ${count} times`);
    });

    return issues;
  });
}

export async function expectAccessibleChrome(page, rootSelector = 'body') {
  expect(await accessibilityIssues(page, rootSelector)).toEqual([]);
}

export async function expectViewportReflow(page, width, height = 800) {
  await page.setViewportSize({ width, height });
  await expect.poll(() => page.evaluate(() => ({
    width: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth
  }))).toMatchObject({ width });
  const overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - window.innerWidth));
  expect(overflow, `horizontal overflow at ${width}px effective viewport`).toBeLessThanOrEqual(2);
}

export async function expectTouchTarget(locator, minimum = 44) {
  const box = await locator.boundingBox();
  expect(box, 'touch target must be rendered').not.toBeNull();
  expect(Number(box?.width || 0), 'touch target width').toBeGreaterThanOrEqual(minimum);
  expect(Number(box?.height || 0), 'touch target height').toBeGreaterThanOrEqual(minimum);
}
