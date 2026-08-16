import { MINIMAX_IMAGE_GENERATION_PATH } from "@roo-code/types"

import { t } from "../../../i18n"

// Image generation types
interface ImageGenerationResponse {
	choices?: Array<{
		message?: {
			content?: string
			images?: Array<{
				type?: string
				image_url?: {
					url?: string
				}
			}>
		}
	}>
	error?: {
		message?: string
		type?: string
		code?: string
	}
}

interface ImagesApiResponse {
	data?: Array<{
		b64_json?: string
		url?: string
	}>
	error?: {
		message?: string
		type?: string
		code?: string
	}
}

export interface ImageGenerationResult {
	success: boolean
	imageData?: string
	imageFormat?: string
	error?: string
}

interface ImageGenerationOptions {
	baseURL: string
	authToken: string
	model: string
	prompt: string
	inputImage?: string
}

interface ImagesApiOptions {
	baseURL: string
	authToken: string
	model: string
	prompt: string
	inputImage?: string
	size?: string
	quality?: string
	outputFormat?: string
}

interface MiniMaxImageOptions {
	baseURL: string
	authToken: string
	model: string
	prompt: string
}

interface MiniMaxImageApiResponse {
	data?: {
		image_urls?: string[]
		image_base64?: string[]
	}
	metadata?: {
		success_count?: number | string
		failed_count?: number | string
	}
	base_resp?: {
		status_code?: number
		status_msg?: string
	}
}

/**
 * Shared image generation implementation for OpenAI-compatible image providers.
 */
export async function generateImageWithProvider(options: ImageGenerationOptions): Promise<ImageGenerationResult> {
	const { baseURL, authToken, model, prompt, inputImage } = options

	try {
		const response = await fetch(`${baseURL}/chat/completions`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
				"HTTP-Referer": "https://github.com/RooVetGit/Roo-Code",
				"X-Title": "Roo Code",
			},
			body: JSON.stringify({
				model,
				messages: [
					{
						role: "user",
						content: inputImage
							? [
									{
										type: "text",
										text: prompt,
									},
									{
										type: "image_url",
										image_url: {
											url: inputImage,
										},
									},
								]
							: prompt,
					},
				],
				modalities: ["image", "text"],
			}),
		})

		if (!response.ok) {
			const errorText = await response.text()
			let errorMessage = t("tools:generateImage.failedWithStatus", {
				status: response.status,
				statusText: response.statusText,
			})

			try {
				const errorJson = JSON.parse(errorText)
				if (errorJson.error?.message) {
					errorMessage = t("tools:generateImage.failedWithMessage", {
						message: errorJson.error.message,
					})
				}
			} catch {
				// Use default error message
			}
			return {
				success: false,
				error: errorMessage,
			}
		}

		const result: ImageGenerationResponse = await response.json()

		if (result.error) {
			return {
				success: false,
				error: t("tools:generateImage.failedWithMessage", {
					message: result.error.message,
				}),
			}
		}

		// Extract the generated image from the response
		const images = result.choices?.[0]?.message?.images
		if (!images || images.length === 0) {
			return {
				success: false,
				error: t("tools:generateImage.noImageGenerated"),
			}
		}

		const imageData = images[0]?.image_url?.url
		if (!imageData) {
			return {
				success: false,
				error: t("tools:generateImage.invalidImageData"),
			}
		}

		// Extract base64 data from data URL
		const base64Match = imageData.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/)
		if (!base64Match) {
			return {
				success: false,
				error: t("tools:generateImage.invalidImageFormat"),
			}
		}

		return {
			success: true,
			imageData: imageData,
			imageFormat: base64Match[1],
		}
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : t("tools:generateImage.unknownError"),
		}
	}
}

/**
 * Generate an image using OpenAI's Images API (/v1/images/generations)
 * Supports BFL models (Flux) with provider-specific options for image editing
 */
export async function generateImageWithImagesApi(options: ImagesApiOptions): Promise<ImageGenerationResult> {
	const { baseURL, authToken, model, prompt, inputImage, outputFormat = "png" } = options

	try {
		const url = `${baseURL}/images/generations`

		// Build the request body
		// For BFL models, inputImage is passed via providerOptions.blackForestLabs.inputImage
		const requestBody: Record<string, unknown> = {
			model,
			prompt,
			n: 1,
		}

		// Add optional parameters
		if (options.size) {
			requestBody.size = options.size
		}
		if (options.quality) {
			requestBody.quality = options.quality
		}

		// For BFL (Black Forest Labs) models like flux-pro-1.1, use providerOptions
		if (model.startsWith("bfl/")) {
			requestBody.providerOptions = {
				blackForestLabs: {
					outputFormat: outputFormat,
					// inputImage: Base64 encoded image or URL of image to use as reference
					...(inputImage && { inputImage }),
				},
			}
		} else {
			// For other models, use standard output_format parameter
			requestBody.output_format = outputFormat
		}

		const fetchOptions: RequestInit = {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
				"HTTP-Referer": "https://github.com/RooVetGit/Roo-Code",
				"X-Title": "Roo Code",
			},
			body: JSON.stringify(requestBody),
		}

		const response = await fetch(url, fetchOptions)

		if (!response.ok) {
			const errorText = await response.text()
			let errorMessage = t("tools:generateImage.failedWithStatus", {
				status: response.status,
				statusText: response.statusText,
			})

			try {
				const errorJson = JSON.parse(errorText)
				if (errorJson.error?.message) {
					errorMessage = t("tools:generateImage.failedWithMessage", {
						message: errorJson.error.message,
					})
				}
			} catch {
				// Use default error message
			}
			return {
				success: false,
				error: errorMessage,
			}
		}

		const result: ImagesApiResponse = await response.json()

		if (result.error) {
			return {
				success: false,
				error: t("tools:generateImage.failedWithMessage", {
					message: result.error.message,
				}),
			}
		}

		// Extract the generated image from the response
		const images = result.data
		if (!images || images.length === 0) {
			return {
				success: false,
				error: t("tools:generateImage.noImageGenerated"),
			}
		}

		const imageItem = images[0]

		// Handle b64_json response (most common)
		if (imageItem?.b64_json) {
			// Convert base64 to data URL
			const dataUrl = `data:image/${outputFormat};base64,${imageItem.b64_json}`
			return {
				success: true,
				imageData: dataUrl,
				imageFormat: outputFormat,
			}
		}

		// Handle URL response (fallback)
		if (imageItem?.url) {
			// If it's already a data URL, use it directly
			if (imageItem.url.startsWith("data:image/")) {
				const formatMatch = imageItem.url.match(/^data:image\/(\w+);/)
				const format = formatMatch?.[1] || outputFormat
				return {
					success: true,
					imageData: imageItem.url,
					imageFormat: format,
				}
			}
			// For external URLs, return as-is (the caller will need to handle fetching)
			return {
				success: true,
				imageData: imageItem.url,
				imageFormat: outputFormat,
			}
		}

		return {
			success: false,
			error: t("tools:generateImage.invalidImageData"),
		}
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : t("tools:generateImage.unknownError"),
		}
	}
}

/**
 * Detect the image format of a raw base64 payload from its magic bytes so the
 * resulting data URL advertises the correct MIME type.
 */
function detectBase64ImageFormat(base64: string): "png" | "jpeg" {
	return base64.startsWith("/9j/") ? "jpeg" : "png"
}

/**
 * Generate an image using the MiniMax image generation API (/v1/image_generation).
 *
 * The endpoint answers with `data.image_base64` when `response_format` is "base64",
 * and reports API level failures through `base_resp.status_code` / `base_resp.status_msg`
 * even for HTTP 200 responses.
 */
export async function generateImageWithMiniMax(options: MiniMaxImageOptions): Promise<ImageGenerationResult> {
	const { baseURL, authToken, model, prompt } = options

	try {
		const url = `${baseURL.replace(/\/$/, "")}${MINIMAX_IMAGE_GENERATION_PATH}`

		const response = await fetch(url, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model,
				prompt,
				n: 1,
				// Ask for inline data so the generated image can be written to disk
				// without depending on the temporary image URLs, which expire.
				response_format: "base64",
			}),
		})

		if (!response.ok) {
			const errorText = await response.text()
			let errorMessage = t("tools:generateImage.failedWithStatus", {
				status: response.status,
				statusText: response.statusText,
			})

			try {
				const errorJson = JSON.parse(errorText)
				const message = errorJson.base_resp?.status_msg ?? errorJson.error?.message

				if (message) {
					errorMessage = t("tools:generateImage.failedWithMessage", { message })
				}
			} catch {
				// Use default error message
			}

			return { success: false, error: errorMessage }
		}

		const result: MiniMaxImageApiResponse = await response.json()

		// MiniMax reports failures in the response body with a non-zero status code.
		if (result.base_resp && result.base_resp.status_code !== 0) {
			return {
				success: false,
				error: t("tools:generateImage.failedWithMessage", {
					message: result.base_resp.status_msg ?? `${result.base_resp.status_code}`,
				}),
			}
		}

		const images = result.data?.image_base64
		const successCount =
			result.metadata?.success_count !== undefined ? Number(result.metadata.success_count) : undefined

		if (!images || images.length === 0 || successCount === 0) {
			return { success: false, error: t("tools:generateImage.noImageGenerated") }
		}

		const image = images[0]

		if (!image) {
			return { success: false, error: t("tools:generateImage.invalidImageData") }
		}

		// Some responses already carry a full data URL.
		if (image.startsWith("data:image/")) {
			const formatMatch = image.match(/^data:image\/(\w+);base64,/)

			if (!formatMatch) {
				return { success: false, error: t("tools:generateImage.invalidImageFormat") }
			}

			return { success: true, imageData: image, imageFormat: formatMatch[1] }
		}

		const imageFormat = detectBase64ImageFormat(image)

		return { success: true, imageData: `data:image/${imageFormat};base64,${image}`, imageFormat }
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : t("tools:generateImage.unknownError"),
		}
	}
}
