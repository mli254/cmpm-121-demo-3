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
      // eslint-disable-next-line @typescript-eslint/quotes
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

interface Geocoin {
  mintingLocation: Cell;
  serialNumber: number;
}

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

let coins = 0;
const coinsCollected: Geocoin[] = [];
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "No coins yet...";

function makeCache(i: number, j: number) {
  const bounds = board.getCellBounds({ i, j });

  const cache = leaflet.rectangle(bounds) as leaflet.Layer;

  cache.bindPopup(() => {
    let value = Math.floor(luck([i, j, "initialValue"].toString()) * 10);
    const coinCache = createCache(value, i, j);
    const container = document.createElement("div");
    writeCache(container, coinCache, i, j, value);

    const deposit = container.querySelector<HTMLButtonElement>("#deposit")!;
    deposit.addEventListener("click", () => {
      if (coins > 0) {
        const depositCoin = coinsCollected.pop()!;
        coinCache.push(depositCoin);
        value++;
        container.querySelector<HTMLSpanElement>("#value")!.innerHTML =
          value.toString();
        coins--;
        statusPanel.innerHTML = `${coins} coins accumulated<br>Inventory:`;
        coinsCollected.forEach(collectedCoin => {
          const { i, j } = collectedCoin.mintingLocation;
          const coinSerial = collectedCoin.serialNumber;
          statusPanel.innerHTML += `<br>${i}:${j}#${coinSerial}`;
        });
        //writeCache(container, coinCache, i, j, value);
      }
    });
    for (let index = 0; index < coinCache.length; index++) {
      const collectButton = container.querySelector("#collect" + index)!;
      collectButton.addEventListener("click", () => {
        if (value > 0) {
          value--;
          container.querySelector<HTMLSpanElement>("#value")!.innerHTML =
            value.toString();
          coins++;
          statusPanel.innerHTML = `${coins} coins accumulated<br>Inventory:`;

          coinsCollected.push(coinCache[index]);
          coinsCollected.forEach(collectedCoin => {
            const { i, j } = collectedCoin.mintingLocation;
            const coinSerial = collectedCoin.serialNumber;
            statusPanel.innerHTML += `<br>${i}:${j}#${coinSerial}`;
          });
        }
      });
    }

    return container;
  });
  cache.addTo(map);
}

const visibleCells: Cell[] = board.getCellsNearPoint(MERRILL_CLASSROOM);
for (const cell of visibleCells) {
  const { i, j } = cell;
  if (luck([i, j].toString()) < CACHE_SPAWN_PROBABILITY) {
    makeCache(i, j);
  }
}

function createCache(amount: number, i: number, j: number) {
  const coinCache: Geocoin[] = [];
  for (let a = 0; a < amount; a++) {
    const coin: Geocoin = { mintingLocation: { i, j }, serialNumber: a };
    coinCache.push(coin);
  }
  return coinCache;
}

function writeCache(container: HTMLDivElement, coinCache: Geocoin[], i: number, j: number, value: number) {
  container.innerHTML = `
                <div>There is a cache here at "${i},${j}". It has value <span id="value">${value}</span>.
                <br>Available coins are:`;
  coinCache.forEach(coin => {
    const { i, j } = coin.mintingLocation;
    const coinSerial = coin.serialNumber;
    container.innerHTML += `${i}:${j}#${coinSerial}
      <button id="collect${coinSerial}">collect</button><br>`;
  });
  container.innerHTML += `<div>`;
  container.innerHTML += `<button id="deposit">deposit</button>`;
}