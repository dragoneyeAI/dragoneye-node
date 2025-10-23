// index.ts
import * as ClassificationAPI from "./classification";
import * as CommonAPI from "./common";
import * as MediaAPI from "./media";

function readEnvVar(key: string): string | undefined {
  return process.env[key];
}

export interface ClientOptions {
  /**
   * Defaults to process.env['DRAGONEYE_API_KEY']
   */
  apiKey?: string | undefined;
}

export class Dragoneye {
  apiKey: string;
  classification: ClassificationAPI.Classification =
    new ClassificationAPI.Classification(this);

  /**
   * Creates a new Dragoneye client instance.
   * @param options - Configuration options for the client.
   * @param options.apiKey - The API key for authentication. Defaults to the DRAGONEYE_API_KEY environment variable.
   * @throws {Error} If no API key is provided and DRAGONEYE_API_KEY environment variable is not set.
   */
  constructor({ apiKey = readEnvVar("DRAGONEYE_API_KEY") }: ClientOptions) {
    if (apiKey === undefined) {
      throw new Error(
        "API key is required: Either DRAGONEYE_API_KEY must be specified, or apiKey should be specified for the client."
      );
    }

    this.apiKey = apiKey;
  }
}

export namespace Dragoneye {
  export import Image = MediaAPI.Image;
  export import Video = MediaAPI.Video;
  export import Classification = ClassificationAPI.Classification;
  export import Common = CommonAPI;
}
