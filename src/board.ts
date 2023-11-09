import leaflet from "leaflet";

export interface Cell {
  readonly i: number;
  readonly j: number;
}

export class Board {
  readonly tileWidth: number;
  readonly tileVisibilityRadius: number;

  private readonly knownCells: Map<string, Cell>;

  constructor(tileWidth: number, tileVisibilityRadius: number) {
    this.tileWidth = tileWidth;
    this.tileVisibilityRadius = tileVisibilityRadius;
    this.knownCells = new Map<string, Cell>();
  }

  private getCanonicalCell(cell: Cell): Cell {
    const { i, j } = cell;
    const key = [i, j].toString();
    if (!this.knownCells.has(key)) {
      this.knownCells.set(key, { i, j });
    }
    return this.knownCells.get(key)!;
  }

  getCellForPoint(point: leaflet.LatLng): Cell {
    const step = 0.0001;
    const { lat, lng } = point;
    const i = Math.round(lat / step);
    const j = Math.round(lng / step);
    return this.getCanonicalCell({ i, j });
  }

  getCellBounds(cell: Cell): leaflet.LatLngBounds {
    const { i, j } = cell;
    const CURRENT_POINT = leaflet.latLng({
      lat: i,
      lng: j,
    });
    return leaflet.latLngBounds([
      [
        CURRENT_POINT.lat, CURRENT_POINT.lng
      ],
      [
        CURRENT_POINT.lat + this.tileWidth,
        CURRENT_POINT.lng + this.tileWidth,
      ],
    ]);
  }

  getCellsNearPoint(point: leaflet.LatLng): Cell[] {
    const resultCells: Cell[] = [];

    for (let x = -this.tileVisibilityRadius; x < this.tileVisibilityRadius; x++) {
      for (let y = -this.tileVisibilityRadius; y < this.tileVisibilityRadius; y++) {
        const i = point.lat + x * this.tileWidth;
        const j = point.lng + y * this.tileWidth;
        const cell = { i, j };
        resultCells.push(cell);
      }
    }
    return resultCells;
  }
}