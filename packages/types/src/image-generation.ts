/**
 * Image generation model constants
 */

/**
 * API method used for image generation
 */
export type ImageGenerationApiMethod = "chat_completions" | "images_api" | "image_generation"

export interface ImageGenerationModel {
	value: string
	label: string
	provider: ImageGenerationProvider
	apiMethod?: ImageGenerationApiMethod
}

export const IMAGE_GENERATION_MODELS: ImageGenerationModel[] = [
	// OpenRouter models
	{ value: "google/gemini-2.5-flash-image", label: "Gemini 2.5 Flash Image", provider: "openrouter" },
	{ value: "google/gemini-3-pro-image-preview", label: "Gemini 3 Pro Image Preview", provider: "openrouter" },
	{ value: "openai/gpt-5-image", label: "GPT-5 Image", provider: "openrouter" },
	{ value: "openai/gpt-5-image-mini", label: "GPT-5 Image Mini", provider: "openrouter" },
	{ value: "black-forest-labs/flux.2-flex", label: "Black Forest Labs FLUX.2 Flex", provider: "openrouter" },
	{ value: "black-forest-labs/flux.2-pro", label: "Black Forest Labs FLUX.2 Pro", provider: "openrouter" },
	// MiniMax models
	{ value: "image-01", label: "Image 01", provider: "minimax", apiMethod: "image_generation" },
	{ value: "image-01-live", label: "Image 01 Live", provider: "minimax", apiMethod: "image_generation" },
]

/**
 * Get array of model values only (for backend validation)
 */
export const IMAGE_GENERATION_MODEL_IDS = IMAGE_GENERATION_MODELS.map((m) => m.value)

/**
 * Image generation provider type
 */
export type ImageGenerationProvider = "openrouter" | "minimax"

/**
 * Get the image generation provider with backwards compatibility
 * - If provider is explicitly set, use it
 * - If a model is already configured (existing users), default to "openrouter"
 * - Otherwise default to "openrouter" (new users)
 */
export function getImageGenerationProvider(
	explicitProvider: ImageGenerationProvider | undefined,
	_hasExistingModel: boolean,
): ImageGenerationProvider {
	return explicitProvider !== undefined ? explicitProvider : "openrouter"
}
