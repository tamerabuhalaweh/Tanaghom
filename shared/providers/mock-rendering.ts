import { createHash } from 'crypto';
import type { RenderingProvider, RenderPackage, RenderPreview, ValidationResult } from './rendering';

function generatePayloadHash(data: Record<string, unknown>): string {
  const sorted = JSON.stringify(data, Object.keys(data).sort());
  return createHash('sha256').update(sorted).digest('hex');
}

export class MockRenderingProvider implements RenderingProvider {
  async prepareRender(renderPackage: RenderPackage): Promise<ValidationResult> {
    const errors: string[] = [];
    if (!renderPackage.platform) errors.push('Platform is required');
    if (!renderPackage.format) errors.push('Format is required');
    if (!renderPackage.assets || renderPackage.assets.length === 0) errors.push('At least one asset is required');
    return { valid: errors.length === 0, errors };
  }

  async validateRenderPackage(renderPackage: RenderPackage): Promise<ValidationResult> {
    return this.prepareRender(renderPackage);
  }

  async mockRenderPreview(renderPackage: RenderPackage): Promise<RenderPreview> {
    const payloadHash = generatePayloadHash({
      platform: renderPackage.platform,
      format: renderPackage.format,
      assets: renderPackage.assets.map(a => a.type),
    });

    return {
      success: true,
      previewReference: `mock-preview-${Date.now()}`,
      payloadHash,
      payloadSummary: `Mock ${renderPackage.format} preview for ${renderPackage.platform} with ${renderPackage.assets.length} assets`,
    };
  }
}
