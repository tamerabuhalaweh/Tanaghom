export interface RenderPackage {
  platform: string;
  format: string;
  dimensions?: string;
  duration?: string;
  assets: { type: string; reference: string }[];
}

export interface RenderPreview {
  success: boolean;
  previewReference?: string;
  payloadHash: string;
  payloadSummary: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface RenderingProvider {
  prepareRender(renderPackage: RenderPackage): Promise<ValidationResult>;
  validateRenderPackage(renderPackage: RenderPackage): Promise<ValidationResult>;
  mockRenderPreview(renderPackage: RenderPackage): Promise<RenderPreview>;
}
