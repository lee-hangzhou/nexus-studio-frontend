import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { ExpertPill } from './ExpertPill';

describe('ExpertPill', () => {
  it('shows selected expert chip with remove control', () => {
    const html = renderToStaticMarkup(
      <ExpertPill
        name="商品策划与文案专家"
        avatarUrl="/avatars/experts/ecom-listing.png"
        onRemove={() => undefined}
      />,
    );
    expect(html).toContain('商品策划与文案专家');
    expect(html).toContain('aria-label="移除专家');
  });

  it('omits remove button when readOnly', () => {
    const html = renderToStaticMarkup(
      <ExpertPill name="项目助手" avatarUrl="/avatars/experts/host.png" readOnly />,
    );
    expect(html).not.toContain('aria-label="移除专家');
  });
});
