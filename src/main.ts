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

interface Geocache {
  cell: Cell;
  amount: number;
  coinCache: Geocoin[];
}

const bus = new EventTarget();

function notify(name: string) {
  bus.dispatchEvent(new Event(name));
}

bus.addEventListener("status-panel-changed", writeStatus);

const playerMarker = leaflet.marker(MERRILL_CLASSROOM);
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

// const sensorButton = document.querySelector("#sensor")!;
// sensorButton.addEventListener("click", () => {
//   navigator.geolocation.watchPosition((position) => {
//     playerMarker.setLatLng(
//       leaflet.latLng(position.coords.latitude, position.coords.longitude)
//     );
//     map.setView(playerMarker.getLatLng());
//   });
// });

const coinsCollected: Geocoin[] = [];
const tilesSeen: Map<string, Cell> = new Map<string, Cell>();
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;

function makeCache(cache: Geocache) {
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
}

const visibleCells: Cell[] = board.getCellsNearPoint(MERRILL_CLASSROOM);
for (const cell of visibleCells) {
  const { i, j } = cell;
  if (luck([i, j].toString()) < CACHE_SPAWN_PROBABILITY) {
    const cache = createCache(cell);
    makeCache(cache);
    const key = [i, j].toString();
    tilesSeen.set(key, { i, j });
  }
}

//=============== FUNCTIONS BELOW ===============

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