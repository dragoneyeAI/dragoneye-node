import {
  BASE_API_URL,
  NormalizedBbox,
  TaxonID,
  TaxonPrediction,
  TaxonomyKingdom,
} from "./common";
import type { Image } from "./image";
import type { Dragoneye } from "./index";
import axios, { AxiosResponse } from "axios";

export interface ClassificationTraitRootPrediction {
  id: TaxonID;
  name: string;
  displayName: string;
  taxons: TaxonPrediction[];
}

export interface ClassificationObjectPrediction {
  normalizedBbox: NormalizedBbox;
  category: TaxonPrediction;
  traits: ClassificationTraitRootPrediction[];
}

export interface ClassificationPredictImageResponse {
  predictions: ClassificationObjectPrediction[];
}

export interface ClassificationPredictImageRequest {
  image: Image;
  taxonomyKingdom: TaxonomyKingdom;
}

export class Classification {
  protected _client: Dragoneye;

  constructor(private client: Dragoneye) {
    this._client = client;
  }

  async predict({
    image,
    taxonomyKingdom,
  }: ClassificationPredictImageRequest): Promise<ClassificationPredictImageResponse> {
    const url = `${BASE_API_URL}/predict`;

    const formData = new FormData();

    if (image.blob !== undefined) {
      formData.append("image_file", image.blob);
    } else if (image.url !== undefined) {
      formData.append("image_url", image.url);
    } else {
      throw new Error(
        "Missing image: Either image file or image url must be specified"
      );
    }

    formData.append("taxonomy_kingdom", taxonomyKingdom.toString());

    const config = {
      headers: {
        "Content-Type": "multipart/form-data",
        Authorization: `Bearer ${this._client.apiKey}`,
      },
    };

    let response: AxiosResponse<any, any>;

    try {
      response = await axios.post(url, formData, config);
    } catch (error) {
      console.error(
        "Error during Dragoneye Classification prediction request:",
        error
      );
      throw error;
    }

    return response.data as ClassificationPredictImageResponse;
  }
}
