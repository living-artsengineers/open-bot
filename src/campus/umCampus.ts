import { getDistance } from "geolib";
import * as buildings from "./buildings.json";

export enum Campus {
  Central = "Central",
  North = "North",
  Remote = "Remote",
}

export function locationOfFacility(facility: string): { address: string; lat: number; lng: number } | null {
  for (const buildingCode of Object.keys(buildings)) {
    if (facility.includes(buildingCode)) {
      return buildings[buildingCode as keyof typeof buildings];
    }
  }
  return null;
}
export function campusOfFacility(facility: string): Campus | null {
  if (facility == null) return null;
  if (facility.includes("REMOTE")) return Campus.Remote;
  const loc = locationOfFacility(facility);
  if (loc == null) return null;
  return campusOfLocation(loc);
}

export function campusOfLocation(loc: { lat: number; lng: number }): Campus {
  const northAnchor = buildings.FXB;
  const centralAnchor = buildings.AH;
  const northDistance = getDistance(loc, northAnchor);
  const centralDistance = getDistance(loc, centralAnchor);
  return northDistance < centralDistance ? Campus.North : Campus.Central;
}

export function distance(loc1: keyof typeof buildings, loc2: keyof typeof buildings): number {
  const l1 = buildings[loc1],
    l2 = buildings[loc2];
  return getDistance(l1, l2);
}
