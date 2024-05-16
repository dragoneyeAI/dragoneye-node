export type TaxonID = number & { readonly brand: unique symbol };

export function createTaxonID(taxonId: number): TaxonID {
  return taxonId as TaxonID;
}

export enum TaxonomyKingdom {
  FASHION = createTaxonID(185024717),
  FURNITURE = createTaxonID(1255307938),
}

export type NormalizedBbox = [number, number, number, number];

export enum TaxonType {
  category = "category",
  trait = "trait",
}

export type TaxonPrediction = {
  id: TaxonID;
  type: TaxonType;
  name: string;
  displayName: string;
  score?: number;
  children: TaxonPrediction;
};

export const BASE_API_URL = "https://api.dragoneye.ai";
