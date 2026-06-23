import { describe, it, expect } from 'vitest';
import { MCP_CONNECTORS, MCP_SKILLS } from '../../frontend/src/modules/mcp-engine/registry-data';

describe('MCP Registry Invariants', () => {
  describe('Connector safety rules', () => {
    it('all connectors have source of truth as STITCH', () => {
      for (const connector of MCP_CONNECTORS) {
        expect(connector.sourceOfTruth).toBe('STITCH');
      }
    });

    it('no connector allows live external execution', () => {
      for (const connector of MCP_CONNECTORS) {
        expect(connector.externalExecution).toMatch(/Blocked|Mock/);
      }
    });

    it('write tools require approval', () => {
      const writeConnectors = MCP_CONNECTORS.filter(c =>
        c.tools.some(t => t.startsWith('create_') || t.startsWith('send_') || t.startsWith('trigger_') || t.startsWith('upload_') || t.startsWith('render_') || t.startsWith('schedule_'))
      );
      for (const connector of writeConnectors) {
        expect(connector.requiresApproval).toBe(true);
      }
    });

    it('M5-sensitive connectors are marked requiresM5', () => {
      const m5Connectors = MCP_CONNECTORS.filter(c =>
        c.id.includes('ghl') || c.id.includes('whatsapp') || c.id.includes('voice') || c.id.includes('rendering')
      );
      for (const connector of m5Connectors) {
        expect(connector.requiresM5).toBe(true);
      }
    });

    it('read_only connectors have no write tools', () => {
      const readOnlyConnectors = MCP_CONNECTORS.filter(c => c.direction === 'read_only');
      for (const connector of readOnlyConnectors) {
        const writeTools = connector.tools.filter(t =>
          t.startsWith('create_') || t.startsWith('send_') || t.startsWith('trigger_') || t.startsWith('upload_') || t.startsWith('render_') || t.startsWith('schedule_')
        );
        expect(writeTools).toHaveLength(0);
      }
    });

    it('no connector displays raw credentials', () => {
      for (const connector of MCP_CONNECTORS) {
        expect(connector.credentialStatus).toMatch(/configured|missing|not_required/);
        // Should never contain actual key values
        expect(connector.credentialStatus).not.toMatch(/sk-|key-|token-/);
      }
    });
  });

  describe('Skill safety rules', () => {
    it('all skills have audit enabled', () => {
      for (const skill of MCP_SKILLS) {
        expect(skill.auditEnabled).toBe(true);
      }
    });

    it('no skill allows direct external calls in demo', () => {
      for (const skill of MCP_SKILLS) {
        expect(skill.canCallExternal).toBe(false);
      }
    });

    it('approval-required skills exist', () => {
      const approvalSkills = MCP_SKILLS.filter(s => s.requiresApproval);
      expect(approvalSkills.length).toBeGreaterThan(0);
    });

    it('SAIF-required skills exist', () => {
      const saifSkills = MCP_SKILLS.filter(s => s.saifRequired);
      expect(saifSkills.length).toBeGreaterThan(0);
    });
  });
});
