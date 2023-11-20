import "leaflet/dist/leaflet.css";
import "./style.css";
import leaflet from "leaflet";
import luck from "./luck";
import "./leafletWorkaround";
import "./board";
import { Board, Cell } from "./board";

const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;

const board = new Board(TILE_DEGREES, NEIGHBORHOOD_SIZE);

const MERRILL_CLASSROOM = leaflet.latLng({
  lat: 36.9995,
  lng: -122.0533,
});

const mapContainer = document.querySelector<HTMLElement>("#map")!;

const map = leaflet.map(mapContainer, {
  center: MERRILL_CLASSROOM,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      "&copy; <a href=\"http://www.openstreetmap.org/copyright\">OpenStreetMap</a>",
  })
  .addTo(map);

interface Geocoin {
  mintingLocation: Cell;
  serialNumber: number;
}

class Geocache {
  constructor(readonly cell: Cell, public amount: number, public coinCache: Geocoin[]) { }
}

const bus = new EventTarget();

function notify(name: string) {
  bus.dispatchEvent(new Event(name));
}

bus.addEventListener("status-panel-changed", writeStatus);
bus.addEventListener("player-moved", drawMap);

const playerMarker = leaflet.marker(MERRILL_CLASSROOM);
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

const coinsCollected: Geocoin[] = [];
const leafletRectangles: leaflet.Layer[] = [];
const playerPositions: leaflet.LatLng[] = [];
const tilesSeen: Map<string, Geocache> = new Map<string, Geocache>();
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
let polyline = leaflet.polyline(playerPositions, { color: "red" }).addTo(map);
let firstMove = true;

function drawCache(cache: Geocache) {
  const { i, j } = cache.cell;
  const bounds = board.getCellBounds({ i, j });
  const rectangle = leaflet.rectangle(bounds) as leaflet.Layer;

  rectangle.bindPopup(() => {
    const container = document.createElement("div");
    writeCache(container, cache);
    writeStatus();
    return container;
  });
  rectangle.addTo(map);
  return rectangle;
}

drawMap();

//=============== FUNCTIONS BELOW ===============

function drawMap() {
  leafletRectangles.forEach(rectangle => {
    rectangle.remove();
  });
  polyline.remove();
  polyline = leaflet.polyline(playerPositions, { color: "red" }).addTo(map);
  const visibleCells: Cell[] = board.getCellsNearPoint(playerMarker.getLatLng());
  for (const cell of visibleCells) {
    const { i, j } = cell;
    if (luck([i, j].toString()) < CACHE_SPAWN_PROBABILITY) {
      const key = [i, j].toString();
      if (!tilesSeen.has(key)) {
        const cache = createCache(cell);
        tilesSeen.set(key, cache);
        const rectangle = drawCache(cache);
        leafletRectangles.push(rectangle);
      } else {
        const cache = tilesSeen.get(key)!;
        const rectangle = drawCache(cache);
        leafletRectangles.push(rectangle);
      }
    }
  }
}

function createCache(cell: Cell) {
  const { i, j } = cell;
  const amount = Math.floor(luck([i, j, "initialValue"].toString()) * 10);
  const coinCache: Geocoin[] = [];
  for (let a = 0; a < amount; a++) {
    const coin: Geocoin = { mintingLocation: cell, serialNumber: a };
    coinCache.push(coin);
  }

  const thisGeoCache: Geocache = {
    cell: cell,
    amount: amount,
    coinCache: coinCache
  };
  return thisGeoCache;
}

function writeCache(container: HTMLDivElement, cache: Geocache) {
  const { i, j } = cache.cell;
  container.innerHTML = `<div>There is a cache here at "${i},${j}". It has value <span id="value">${cache.amount}</span>.
  <br><br>`;
  container.innerHTML += "Available coins are:<br>";
  for (let c = 0; c < cache.coinCache.length; c++) {
    const { i, j } = cache.coinCache[c].mintingLocation;
    const coinSerial = cache.coinCache[c].serialNumber;
    container.innerHTML += `${i}:${j}#${coinSerial}
      <button id="collect${c}">collect</button><br>`;
  }
  container.innerHTML += `<button id="deposit">deposit</button></div>`;

  const deposit = container.querySelector("#deposit")!;
  deposit.addEventListener("click", () => {
    if (coinsCollected.length > 0) {
      depositCoin(coinsCollected[0], cache);
      writeCache(container, cache);
    }
  });

  for (let index = 0; index < cache.coinCache.length; index++) {
    const collectButton = container.querySelector("#collect" + index)!;
    collectButton.addEventListener("click", () => {
      if (cache.amount > 0) {
        collectCoin(cache.coinCache[index], cache);
        writeCache(container, cache);
      }
    });
  }
}

function writeStatus() {
  statusPanel.innerHTML = `${coinsCollected.length} coins accumulated<br>Inventory:`;
  coinsCollected.forEach(collectedCoin => {
    const { i, j } = collectedCoin.mintingLocation;
    const coinSerial = collectedCoin.serialNumber;
    statusPanel.innerHTML += `<br>${i}:${j}#${coinSerial}`;
  });
}

function collectCoin(coin: Geocoin, cache: Geocache) {
  const index = cache.coinCache.indexOf(coin);
  cache.coinCache.splice(index, 1);
  coinsCollected.push(coin);
  cache.amount--;
  notify("status-panel-changed");
}

function depositCoin(coin: Geocoin, cache: Geocache) {
  const index = coinsCollected.indexOf(coin);
  coinsCollected.splice(index, 1);
  cache.coinCache.push(coin);
  cache.amount++;
  notify("status-panel-changed");
}

//========= CONTROL PANEL =========
const northButton = document.querySelector("#north")!;
const southButton = document.querySelector("#south")!;
const westButton = document.querySelector("#west")!;
const eastButton = document.querySelector("#east")!;
const sensorButton = document.querySelector("#sensor")!;

northButton.addEventListener("click", () => {
  const currentPosition = playerMarker.getLatLng();
  if (firstMove) {
    playerPositions.push(currentPosition);
    firstMove = false;
  }
  playerMarker.setLatLng({
    lat: currentPosition.lat + TILE_DEGREES,
    lng: currentPosition.lng
  });
  map.setView(playerMarker.getLatLng());
  playerPositions.push(playerMarker.getLatLng());
  notify("player-moved");
});

southButton.addEventListener("click", () => {
  const currentPosition = playerMarker.getLatLng();
  if (firstMove) {
    playerPositions.push(currentPosition);
    firstMove = false;
  }
  playerMarker.setLatLng({
    lat: currentPosition.lat - TILE_DEGREES,
    lng: currentPosition.lng
  });
  map.setView(playerMarker.getLatLng());
  playerPositions.push(playerMarker.getLatLng());
  notify("player-moved");
});

eastButton.addEventListener("click", () => {
  const currentPosition = playerMarker.getLatLng();
  if (firstMove) {
    playerPositions.push(currentPosition);
    firstMove = false;
  }
  playerMarker.setLatLng({
    lat: currentPosition.lat,
    lng: currentPosition.lng + TILE_DEGREES
  });
  map.setView(playerMarker.getLatLng());
  playerPositions.push(playerMarker.getLatLng());
  notify("player-moved");
});

westButton.addEventListener("click", () => {
  const currentPosition = playerMarker.getLatLng();
  if (firstMove) {
    playerPositions.push(currentPosition);
    firstMove = false;
  }
  playerMarker.setLatLng({
    lat: currentPosition.lat,
    lng: currentPosition.lng - TILE_DEGREES
  });
  map.setView(playerMarker.getLatLng());
  playerPositions.push(playerMarker.getLatLng());
  notify("player-moved");
});

sensorButton.addEventListener("click", () => {
  navigator.geolocation.watchPosition((position) => {
    playerMarker.setLatLng(
      leaflet.latLng(position.coords.latitude, position.coords.longitude)
    );
    map.setView(playerMarker.getLatLng());
    playerPositions.push(playerMarker.getLatLng());
    notify("player-moved");
  });
});