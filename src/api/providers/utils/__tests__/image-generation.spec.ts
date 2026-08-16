import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { generateImageWithImagesApi, generateImageWithMiniMax, generateImageWithProvider } from "../image-generation"

// Mock the i18n module
vi.mock("../../../i18n", () => ({
	t: (key: string, options?: any) => {
		// Return a sensible mock for i18n
		if (key === "tools:generateImage.failedWithMessage" && options?.message) {
			return options.message
		}
		return key
	},
}))

// Mock fetch globally
global.fetch = vi.fn()
global.FormData = vi.fn(() => ({
	append: vi.fn(),
})) as any
global.Blob = vi.fn() as any
global.atob = vi.fn((str: string) => {
	return Buffer.from(str, "base64").toString("binary")
})

describe("generateImageWithImagesApi", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe("image generation (text-to-image)", () => {
		it("should successfully generate an image", async () => {
			const mockBase64 = Buffer.from("fake image data").toString("base64")
			const mockResponse = {
				ok: true,
				json: vi.fn().mockResolvedValue({
					data: [{ b64_json: mockBase64 }],
				}),
			}

			vi.mocked(global.fetch).mockResolvedValue(mockResponse as any)

			const result = await generateImageWithImagesApi({
				baseURL: "https://api.example.com/v1",
				authToken: "test-token",
				model: "gpt-image-1",
				prompt: "A cute cat",
				outputFormat: "png",
			})

			expect(result.success).toBe(true)
			expect(result.imageData).toContain("data:image/png;base64,")
			expect(result.imageFormat).toBe("png")

			// Verify fetch was called with correct parameters
			expect(global.fetch).toHaveBeenCalledWith(
				"https://api.example.com/v1/images/generations",
				expect.objectContaining({
					method: "POST",
					headers: expect.objectContaining({
						Authorization: "Bearer test-token",
						"Content-Type": "application/json",
					}),
				}),
			)
		})

		it("should handle API errors gracefully", async () => {
			const mockResponse = {
				ok: false,
				status: 400,
				statusText: "Bad Request",
				text: vi.fn().mockResolvedValue("{}"),
			}

			vi.mocked(global.fetch).mockResolvedValue(mockResponse as any)

			const result = await generateImageWithImagesApi({
				baseURL: "https://api.example.com/v1",
				authToken: "test-token",
				model: "gpt-image-1",
				prompt: "A cute cat",
			})

			expect(result.success).toBe(false)
			expect(result.error).toBeDefined()
		})

		it("should handle missing image data in response", async () => {
			const mockResponse = {
				ok: true,
				json: vi.fn().mockResolvedValue({
					data: [{}], // Missing b64_json and url
				}),
			}

			vi.mocked(global.fetch).mockResolvedValue(mockResponse as any)

			const result = await generateImageWithImagesApi({
				baseURL: "https://api.example.com/v1",
				authToken: "test-token",
				model: "gpt-image-1",
				prompt: "A cute cat",
			})

			expect(result.success).toBe(false)
			expect(result.error).toBeDefined()
		})

		it("should handle URL response instead of b64_json", async () => {
			const mockResponse = {
				ok: true,
				json: vi.fn().mockResolvedValue({
					data: [{ url: "data:image/png;base64,iVBORw0KGgo=" }],
				}),
			}

			vi.mocked(global.fetch).mockResolvedValue(mockResponse as any)

			const result = await generateImageWithImagesApi({
				baseURL: "https://api.example.com/v1",
				authToken: "test-token",
				model: "gpt-image-1",
				prompt: "A cute cat",
			})

			expect(result.success).toBe(true)
			expect(result.imageData).toBe("data:image/png;base64,iVBORw0KGgo=")
			expect(result.imageFormat).toBe("png")
		})

		it("should handle external URL response", async () => {
			const mockResponse = {
				ok: true,
				json: vi.fn().mockResolvedValue({
					data: [{ url: "https://example.com/generated-image.png" }],
				}),
			}

			vi.mocked(global.fetch).mockResolvedValue(mockResponse as any)

			const result = await generateImageWithImagesApi({
				baseURL: "https://api.example.com/v1",
				authToken: "test-token",
				model: "gpt-image-1",
				prompt: "A cute cat",
				outputFormat: "png",
			})

			expect(result.success).toBe(true)
			expect(result.imageData).toBe("https://example.com/generated-image.png")
			expect(result.imageFormat).toBe("png")
		})

		it("should handle empty data array in response", async () => {
			const mockResponse = {
				ok: true,
				json: vi.fn().mockResolvedValue({
					data: [],
				}),
			}

			vi.mocked(global.fetch).mockResolvedValue(mockResponse as any)

			const result = await generateImageWithImagesApi({
				baseURL: "https://api.example.com/v1",
				authToken: "test-token",
				model: "gpt-image-1",
				prompt: "A cute cat",
			})

			expect(result.success).toBe(false)
			expect(result.error).toBeDefined()
		})

		it("should handle API error response", async () => {
			const mockResponse = {
				ok: true,
				json: vi.fn().mockResolvedValue({
					error: {
						message: "Rate limit exceeded",
						type: "rate_limit_error",
					},
				}),
			}

			vi.mocked(global.fetch).mockResolvedValue(mockResponse as any)

			const result = await generateImageWithImagesApi({
				baseURL: "https://api.example.com/v1",
				authToken: "test-token",
				model: "gpt-image-1",
				prompt: "A cute cat",
			})

			expect(result.success).toBe(false)
			expect(result.error).toBeDefined()
		})

		it("should include optional parameters when provided", async () => {
			const mockBase64 = Buffer.from("fake image data").toString("base64")
			const mockResponse = {
				ok: true,
				json: vi.fn().mockResolvedValue({
					data: [{ b64_json: mockBase64 }],
				}),
			}

			vi.mocked(global.fetch).mockResolvedValue(mockResponse as any)

			const result = await generateImageWithImagesApi({
				baseURL: "https://api.example.com/v1",
				authToken: "test-token",
				model: "gpt-image-1",
				prompt: "A cute cat",
				size: "1024x1024",
				quality: "hd",
				outputFormat: "png",
			})

			expect(result.success).toBe(true)

			// Verify fetch was called with optional parameters
			const callArgs = vi.mocked(global.fetch).mock.calls[0]
			const body = JSON.parse(callArgs[1]?.body as string)
			expect(body.size).toBe("1024x1024")
			expect(body.quality).toBe("hd")
		})

		it("should handle network errors", async () => {
			vi.mocked(global.fetch).mockRejectedValue(new Error("Network error"))

			const result = await generateImageWithImagesApi({
				baseURL: "https://api.example.com/v1",
				authToken: "test-token",
				model: "gpt-image-1",
				prompt: "A cute cat",
			})

			expect(result.success).toBe(false)
			expect(result.error).toContain("Network error")
		})
	})

	describe("image editing", () => {
		it("should use /images/generations endpoint with inputImage in request body", async () => {
			const mockBase64 = Buffer.from("fake image data").toString("base64")
			const mockResponse = {
				ok: true,
				json: vi.fn().mockResolvedValue({
					data: [{ b64_json: mockBase64 }],
				}),
			}

			vi.mocked(global.fetch).mockResolvedValue(mockResponse as any)

			const inputImageDataUrl = `data:image/png;base64,${mockBase64}`

			const result = await generateImageWithImagesApi({
				baseURL: "https://api.example.com/v1",
				authToken: "test-token",
				model: "gpt-image-1",
				prompt: "Make it blue",
				inputImage: inputImageDataUrl,
				outputFormat: "png",
			})

			expect(result.success).toBe(true)

			// Verify /images/generations endpoint was used (not /images/edits)
			const callUrl = vi.mocked(global.fetch).mock.calls[0][0]
			expect(callUrl).toContain("/images/generations")
		})

		it("should handle edit operation errors", async () => {
			const mockResponse = {
				ok: false,
				status: 400,
				statusText: "Bad Request",
				text: vi.fn().mockResolvedValue("{}"),
			}

			vi.mocked(global.fetch).mockResolvedValue(mockResponse as any)

			const inputImageDataUrl =
				"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

			const result = await generateImageWithImagesApi({
				baseURL: "https://api.example.com/v1",
				authToken: "test-token",
				model: "gpt-image-1",
				prompt: "Make it blue",
				inputImage: inputImageDataUrl,
			})

			expect(result.success).toBe(false)
			expect(result.error).toBeDefined()
		})
	})

	describe("output format handling", () => {
		it("should use png format by default", async () => {
			const mockBase64 = Buffer.from("fake image data").toString("base64")
			const mockResponse = {
				ok: true,
				json: vi.fn().mockResolvedValue({
					data: [{ b64_json: mockBase64 }],
				}),
			}

			vi.mocked(global.fetch).mockResolvedValue(mockResponse as any)

			const result = await generateImageWithImagesApi({
				baseURL: "https://api.example.com/v1",
				authToken: "test-token",
				model: "gpt-image-1",
				prompt: "A cute cat",
			})

			expect(result.imageFormat).toBe("png")
			expect(result.imageData).toContain("data:image/png;base64,")
		})

		it("should use specified output format", async () => {
			const mockBase64 = Buffer.from("fake image data").toString("base64")
			const mockResponse = {
				ok: true,
				json: vi.fn().mockResolvedValue({
					data: [{ b64_json: mockBase64 }],
				}),
			}

			vi.mocked(global.fetch).mockResolvedValue(mockResponse as any)

			const result = await generateImageWithImagesApi({
				baseURL: "https://api.example.com/v1",
				authToken: "test-token",
				model: "gpt-image-1",
				prompt: "A cute cat",
				outputFormat: "jpeg",
			})

			expect(result.imageFormat).toBe("jpeg")
			expect(result.imageData).toContain("data:image/jpeg;base64,")
		})
	})
})

describe("generateImageWithProvider (chat completions)", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	it("should use /chat/completions endpoint", async () => {
		const mockResponse = {
			ok: true,
			json: vi.fn().mockResolvedValue({
				choices: [
					{
						message: {
							images: [
								{
									image_url: {
										url: "data:image/png;base64,iVBORw0KGgo=",
									},
								},
							],
						},
					},
				],
			}),
		}

		vi.mocked(global.fetch).mockResolvedValue(mockResponse as any)

		const result = await generateImageWithProvider({
			baseURL: "https://api.example.com/v1",
			authToken: "test-token",
			model: "gpt-4-vision",
			prompt: "A cute cat",
		})

		expect(result.success).toBe(true)

		// Verify /chat/completions endpoint was used
		const callUrl = vi.mocked(global.fetch).mock.calls[0][0]
		expect(callUrl).toContain("/chat/completions")
	})

	it("should handle missing images in response", async () => {
		const mockResponse = {
			ok: true,
			json: vi.fn().mockResolvedValue({
				choices: [{ message: { content: "No images" } }],
			}),
		}

		vi.mocked(global.fetch).mockResolvedValue(mockResponse as any)

		const result = await generateImageWithProvider({
			baseURL: "https://api.example.com/v1",
			authToken: "test-token",
			model: "gpt-4-vision",
			prompt: "A cute cat",
		})

		expect(result.success).toBe(false)
		expect(result.error).toBeDefined()
	})
})

describe("generateImageWithMiniMax", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	it("should post to the image generation endpoint and return a data URL", async () => {
		const mockBase64 = "iVBORw0KGgoAAAANSUhEUg=="
		const mockResponse = {
			ok: true,
			json: vi.fn().mockResolvedValue({
				data: { image_base64: [mockBase64] },
				metadata: { success_count: "1", failed_count: "0" },
				base_resp: { status_code: 0, status_msg: "success" },
			}),
		}

		vi.mocked(global.fetch).mockResolvedValue(mockResponse as any)

		const result = await generateImageWithMiniMax({
			baseURL: "https://api.example.com/v1",
			authToken: "test-token",
			model: "image-01",
			prompt: "A cute cat",
		})

		expect(result.success).toBe(true)
		expect(result.imageFormat).toBe("png")
		expect(result.imageData).toBe(`data:image/png;base64,${mockBase64}`)

		expect(global.fetch).toHaveBeenCalledWith(
			"https://api.example.com/v1/image_generation",
			expect.objectContaining({
				method: "POST",
				headers: expect.objectContaining({
					Authorization: "Bearer test-token",
					"Content-Type": "application/json",
				}),
			}),
		)

		const callArgs = vi.mocked(global.fetch).mock.calls[0]
		const body = JSON.parse(callArgs[1]?.body as string)
		expect(body).toEqual({ model: "image-01", prompt: "A cute cat", n: 1, response_format: "base64" })
	})

	it("should not duplicate the slash when the base URL has a trailing slash", async () => {
		const mockResponse = {
			ok: true,
			json: vi.fn().mockResolvedValue({
				data: { image_base64: ["iVBORw0KGgo="] },
			}),
		}

		vi.mocked(global.fetch).mockResolvedValue(mockResponse as any)

		const result = await generateImageWithMiniMax({
			baseURL: "https://api.example.com/v1/",
			authToken: "test-token",
			model: "image-01",
			prompt: "A cute cat",
		})

		expect(result.success).toBe(true)
		expect(vi.mocked(global.fetch).mock.calls[0][0]).toBe("https://api.example.com/v1/image_generation")
	})

	it("should detect the jpeg format from the base64 payload", async () => {
		const mockBase64 = "/9j/4AAQSkZJRgABAQ=="
		const mockResponse = {
			ok: true,
			json: vi.fn().mockResolvedValue({
				data: { image_base64: [mockBase64] },
			}),
		}

		vi.mocked(global.fetch).mockResolvedValue(mockResponse as any)

		const result = await generateImageWithMiniMax({
			baseURL: "https://api.example.com/v1",
			authToken: "test-token",
			model: "image-01",
			prompt: "A cute cat",
		})

		expect(result.success).toBe(true)
		expect(result.imageFormat).toBe("jpeg")
		expect(result.imageData).toBe(`data:image/jpeg;base64,${mockBase64}`)
	})

	it("should keep a payload that already is a data URL", async () => {
		const mockResponse = {
			ok: true,
			json: vi.fn().mockResolvedValue({
				data: { image_base64: ["data:image/png;base64,iVBORw0KGgo="] },
			}),
		}

		vi.mocked(global.fetch).mockResolvedValue(mockResponse as any)

		const result = await generateImageWithMiniMax({
			baseURL: "https://api.example.com/v1",
			authToken: "test-token",
			model: "image-01",
			prompt: "A cute cat",
		})

		expect(result.success).toBe(true)
		expect(result.imageFormat).toBe("png")
		expect(result.imageData).toBe("data:image/png;base64,iVBORw0KGgo=")
	})

	it("should surface a non-zero status code from the response body", async () => {
		const mockResponse = {
			ok: true,
			json: vi.fn().mockResolvedValue({
				base_resp: { status_code: 1026, status_msg: "Sensitive content detected in prompt" },
			}),
		}

		vi.mocked(global.fetch).mockResolvedValue(mockResponse as any)

		const result = await generateImageWithMiniMax({
			baseURL: "https://api.example.com/v1",
			authToken: "test-token",
			model: "image-01",
			prompt: "A cute cat",
		})

		expect(result.success).toBe(false)
		expect(result.error).toBe("Sensitive content detected in prompt")
	})

	it("should surface the status message of an HTTP error", async () => {
		const mockResponse = {
			ok: false,
			status: 401,
			statusText: "Unauthorized",
			text: vi
				.fn()
				.mockResolvedValue(JSON.stringify({ base_resp: { status_code: 1004, status_msg: "Bad key" } })),
		}

		vi.mocked(global.fetch).mockResolvedValue(mockResponse as any)

		const result = await generateImageWithMiniMax({
			baseURL: "https://api.example.com/v1",
			authToken: "test-token",
			model: "image-01",
			prompt: "A cute cat",
		})

		expect(result.success).toBe(false)
		expect(result.error).toBe("Bad key")
	})

	it("should fail when no image was generated", async () => {
		const mockResponse = {
			ok: true,
			json: vi.fn().mockResolvedValue({
				data: { image_base64: [] },
				metadata: { success_count: "0", failed_count: "1" },
				base_resp: { status_code: 0, status_msg: "success" },
			}),
		}

		vi.mocked(global.fetch).mockResolvedValue(mockResponse as any)

		const result = await generateImageWithMiniMax({
			baseURL: "https://api.example.com/v1",
			authToken: "test-token",
			model: "image-01",
			prompt: "A cute cat",
		})

		expect(result.success).toBe(false)
		expect(result.error).toBe("tools:generateImage.noImageGenerated")
	})

	it("should fail when every requested image was rejected", async () => {
		const mockResponse = {
			ok: true,
			json: vi.fn().mockResolvedValue({
				data: { image_base64: ["iVBORw0KGgo="] },
				metadata: { success_count: 0, failed_count: 1 },
			}),
		}

		vi.mocked(global.fetch).mockResolvedValue(mockResponse as any)

		const result = await generateImageWithMiniMax({
			baseURL: "https://api.example.com/v1",
			authToken: "test-token",
			model: "image-01",
			prompt: "A cute cat",
		})

		expect(result.success).toBe(false)
		expect(result.error).toBe("tools:generateImage.noImageGenerated")
	})

	it("should handle network errors", async () => {
		vi.mocked(global.fetch).mockRejectedValue(new Error("Network error"))

		const result = await generateImageWithMiniMax({
			baseURL: "https://api.example.com/v1",
			authToken: "test-token",
			model: "image-01",
			prompt: "A cute cat",
		})

		expect(result.success).toBe(false)
		expect(result.error).toContain("Network error")
	})
})
