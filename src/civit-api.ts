/**
 * Minimal subset of the API needed
 * @see https://github.com/civitai/civitai/wiki/REST-API-Reference#get-apiv1models
 */

type ModelFile = {
  name: string
  /**
   * TODO doc is inconsistent on this string
   */
  format: "PickleTensor" | "SafeTensor"
  downloadUrl: string
}

type ModelImage = {
  url: string
  /** TODO doc looks wrong for this, it says string */
  nsfw: boolean
  width: number
  height: number
  hash: string
  /**
   * Generate params. TODO embed this on the fly if needed?
   */
  meta: object
}

type ModelVersion = {
  id: number
  name: string
  /** HTML */
  description: string
  // TODO check LORA, was not specified in docs
  type: "Checkpoint" | "TextualInversion" | "Hypernetwork" | "AestheticGradient" | "LORA"
  nsfw: boolean
  trainedWords: string[]
  /**
   * ISO Timestamp
   * @example "2022-11-13T02:43:39.839Z"
   */
  createdAt: string
  downloadUrl: string
  images: ModelImage[]
}

export type GetModelResponse = {
  items: {
    id: number
    name: string
    /** HTML */
    description: string
    // TODO check LORA, was not specified in docs
    type: "Checkpoint" | "TextualInversion" | "Hypernetwork" | "AestheticGradient" | "LORA"
    nsfw: boolean
    tags: []
    modelVersions: ModelVersion[]
  }[]
}

export const getModel = async (id: number): Promise<GetModelResponse> => {
  const response = await fetch(`https://civitai.com/api/v1/models/${id}`)
  return (await response.json()) as GetModelResponse
}

export type GetModelVersionResponse = {
  modelId: number
  modelName: string
  files: ModelFile[]
  images: ModelImage[]
  downloadUrl: string
}

/**
 * @see https://github.com/civitai/civitai/wiki/REST-API-Reference#get-apiv1models-versionsmodelversionid
 * @param id
 * @returns
 */
export const getModelVersion = async (id: number): Promise<GetModelVersionResponse> => {
  const response = await fetch(`https://civitai.com/api/v1/model-versions/${id}`)
  return (await response.json()) as GetModelVersionResponse
}
