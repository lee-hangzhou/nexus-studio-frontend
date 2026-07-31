import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const panelSource = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'WorkshopSidePanel.tsx'),
  'utf8',
);
const membersSource = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'WorkshopMembersList.tsx'),
  'utf8',
);
const visibleWorkshopSource = `${panelSource}\n${membersSource}`;
const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

function readTsxSources(directory: string): string {
  return readdirSync(directory)
    .flatMap((name) => {
      const entry = path.join(directory, name);
      if (statSync(entry).isDirectory()) return readTsxSources(entry);
      return name.endsWith('.tsx') ? [readFileSync(entry, 'utf8')] : [];
    })
    .join('\n');
}

const globalUiSource = readTsxSources(srcRoot);

const forbiddenUiCopy = [
  '说明目标',
  '整理在这里',
  '集中保存在这里',
  '分开管理',
  '入场',
  '后会显示',
  '可以随时',
  '将会',
  '暂无交付物',
  'Host',
  'Agent',
  'Expert Profile',
  '弱验收',
  '系统事件',
  '接口就绪',
  '协作成员',
  '外部能力',
  'Diff',
];

describe('WorkshopSidePanel copy audit', () => {
  it('exposes unified overview / resources / members / connect tabs', () => {
    expect(panelSource).toContain("label: '概览'");
    expect(panelSource).toContain("label: '资源'");
    expect(panelSource).toContain("label: '成员'");
    expect(panelSource).toContain("label: '连接'");
    expect(panelSource).not.toContain("label: '项目情况'");
    expect(panelSource).not.toContain("label: '项目资源'");
  });

  it('keeps invite on members tab, connectors on connect tab', () => {
    expect(panelSource).toContain('更多专家');
    expect(panelSource).toContain('DataSourcesPanel');
    expect(panelSource).toContain('sessionResources');
  });

  it('does not label roster as room members', () => {
    expect(panelSource).not.toContain('协作成员');
    expect(panelSource).not.toContain('当前在场成员');
  });

  it('has no refresh button,资料 label, or scene/team jargon', () => {
    expect(panelSource).not.toMatch(/>\s*刷新\s*</);
    expect(panelSource).not.toMatch(/>\s*详情\s*</);
    expect(panelSource).not.toMatch(/['"`]资料['"`]/);
    expect(panelSource).not.toContain('专家团');
    expect(panelSource).not.toContain('场景');
  });

  it('avoids internal jargon in user-visible copy', () => {
    for (const phrase of forbiddenUiCopy) {
      expect(globalUiSource).not.toMatch(
        new RegExp(`>[^<\\r\\n]*${phrase}[^<\\r\\n]*<`),
      );
      expect(globalUiSource).not.toMatch(
        new RegExp(
          `(label|description|message|title|placeholder|aria-label)=["'][^"']*${phrase}`,
        ),
      );
    }
  });

  it('uses compact factual empty states without large illustrations', () => {
    expect(panelSource).toContain('>暂无任务</');
    expect(panelSource).not.toContain('项目产物');
    expect(panelSource).toContain('生成内容');
    // 结果 / 待确认仅在有内容时出现，不堆空壳文案
    expect(panelSource).not.toContain('>暂无待确认操作</');
    expect(panelSource).not.toContain('准备执行方案');
    expect(panelSource).not.toContain('加入项目');
    expect(membersSource).not.toContain('分配任务');
    expect(visibleWorkshopSource).not.toContain('<Empty');
  });

  it('titles the members section as current experts', () => {
    expect(panelSource).toContain('当前专家');
    expect(panelSource).toContain('更多专家');
  });

  it('shows each member task state once; invite lives on members tab', () => {
    expect(membersSource).not.toContain("'待命'");
    expect(membersSource).not.toContain('className={styles.status}');
    expect(membersSource).not.toMatch(/>\s*邀请\s*</);
    expect(panelSource).toMatch(/>\s*邀请\s*</);
    expect(panelSource).toContain('更多专家');
  });

  it('makes the overflow member count interactive and names hidden members', () => {
    expect(panelSource).toContain('hiddenAvatars.map((member) => member.name)');
    expect(panelSource).toContain('onClick={focusMembersSection}');
  });

  it('exposes a single close control when onClose is provided', () => {
    expect(panelSource).toContain('onClose?: () => void');
    expect(panelSource).toContain('aria-label="关闭"');
  });
});
