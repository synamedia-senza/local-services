const content = [
  {"emoji": "🚨", "name": "Emergency", "content": "Always dial 999 in an emergency for police, fire and ambulance services."},
  {"emoji": "🏥", "name": "Hospital"},
  {"emoji": "🧑‍⚕️", "name": "Doctor"},
  {"emoji": "🦷", "name": "Dentist"},
  {"emoji": "💊", "name": "Pharmacy"},
  {"emoji": "💆", "name": "Therapist"},
  {"emoji": "💁", "name": "Social Services"},
  {"emoji": "🍽️", "name": "Food Assistance"},
  {"emoji": "🧓", "name": "Senior Center"},
  {"emoji": "⛪️", "name": "Church"},
  {"emoji": "🕍", "name": "Synagogue"},
  {"emoji": "🕌", "name": "Mosque"},
  {"emoji": "🔌", "name": "Electric Utility"},
  {"emoji": "🚰", "name": "Water Utility"},
  {"emoji": "⛽️", "name": "Gas Utility"}
];

let Place;
let ipData = {};
let displayLocation = "";
let searchLocation = "";

window.addEventListener("load", async () => {
  try {
    await senza.init();

    loadGoogleAPI();
    Place = (await google.maps.importLibrary("places")).Place;

    await getLocation();
    createTable(content);
    
    senza.uiReady();
  } catch (error) {
    console.error(error);
  }
});

async function getLocation() {
  await senza.init();
  let ipAddress = senza.isRunningE2E() ? senza.deviceManager.deviceInfo.clientIp : "";
  ipData = await (await fetch(`https://api.ipdata.co/${ipAddress}?api-key=${ipDataAPIKey}`)).json();
  
  // if city in UK is undefined, hardcode to London
  if (ipData.city == undefined && ipData.country_code == "GB") {
    ipData.city = "London";
    ipData.region = "Greater London";
  }
  
  // add postcode precision for known cities 
  const postcodes = {"London": "SE1 9HA", "Brooklyn": "11211"};
  ipData.postcode = postcodes[ipData.city];

  displayLocation = ipData.postcode ? `${ipData.city}, ${ipData.postcode}` : ipData.city;
  searchLocation = `${displayLocation}, ${ipData.region}, ${ipData.country_name}`;
  header.textContent = `Local Services in ${displayLocation}`;
}

const width = 3;
let height;
let selX = 0;
let selY = 0;

function createTable(items) {
  let groups = chunkArray(items, width);
  height = groups.length;

	let table = document.getElementById("grid");
  for (let group of groups) {
		let row = table.insertRow();
    for (let item of group) {
			let cell = row.insertCell();
			cell.classList.add("cell");
      
      if (item.emoji) cell.appendChild(makeElement("div", "emoji", item.emoji));
      cell.appendChild(makeElement("div", "name", checkSpelling(item.name)));

      let content = makeElement("div", "content", item.content || "");
      cell.appendChild(content);
      if (item.name == "Emergency") {
        content.textContent = updateEmergencyNumber(item.content);
      } else {
        findService(item, cell, content);
      }
		}
	}
  select();
} 

async function findService(item, cell, content) {
  let query = `${item.name} near ${searchLocation}`;
  let places = await searchPlaces(query, 1);
  if (places.length) {
    let place = places[0];
    content.innerHTML = `<b>${cleanTitle(place.displayName)}</b><br>${place.formattedAddress}<br>${place.nationalPhoneNumber || ""}`;
    cell.href = `map.html?id=${place.id}`;
  }
}

async function searchPlaces(textQuery, maxResultCount = 6) {
  const request = {textQuery, maxResultCount, language: 'en-US',
    fields: ['displayName', 'location', 'formattedAddress', 'nationalPhoneNumber']};
  let { places } = await Place.searchByText(request);
  console.log(places);
  return places;
}

function selectedCell() {
	return document.getElementsByClassName("cell")[selY * width + selX];
}

function getCells() {
	return Array.from(document.getElementsByClassName("cell"));
}

// User Interface

document.addEventListener("keydown", function(event) {
  console.log(event.key);
  
  if (event.key === "ArrowUp") {
    up();
  } else if (event.key === "ArrowDown") {
    down();
  } else if (event.key === "ArrowLeft") {
    left();
  } else if (event.key === "ArrowRight") {
    right();
  } else if (event.key === "Enter") {
    action();
  } else if (event.key === "Escape") {
    back();
  } else {
    return;
  }

  event.preventDefault();
});

function action() {
  let cell = selectedCell();
  if (cell.href) {
    window.location = cell.href;
  } else if (cell.video) {
    playVideo(cell.video);
  }
}

function back() {
  if (typeof senza !== 'undefined' && senza.lifecycle.state == senza.lifecycle.UiState.BACKGROUND) {
    senza.lifecycle.moveToForeground();
  } else {
    history.back();
  }
}

function up() {
	deselect();
	selY = (selY - 1 + height) % height;
	select();
}

function down() {
	deselect();
	selY = (selY + 1) % height;
	select();
}

function left() {
	deselect();
	selX = (selX - 1 + width) % width;
	select();
}

function right() {
	deselect();
	selX = (selX + 1) % width;
	select();
}

function select() {
  let cell = selectedCell();
	cell.classList.add("selected");
  cell.scrollIntoView({behavior: 'auto', block: 'center', inline: 'center'});
}

function deselect() {
	selectedCell().classList.remove("selected");
}

// Helpers

function makeElement(type, theClass, content) {
  let element = document.createElement(type);
  element.classList.add(theClass);
  element.innerHTML = content;
  return element;
}

function checkSpelling(content) {
  if (ipData.country_code == "GB") {
    return content.replace("Center", "Centre");
  } else {
    return content;
  }
}

function updateEmergencyNumber(content) {
  if (ipData.longitude < -25) { // Americas
    return content.replace("999", "911");
  } else if (ipData.is_eu) { // European Union
    return content.replace("999", "112");
  } else {
    return content;
  }
}

function cleanTitle(string) {
  return string
    .replace(/\s*\([^)]*\)/g, "") // remove (stuff in parentheses)
    .replace(/ - /g, " ") // clean up " - "
    .replace(/ \+ /g, " ") // clean up " + "
    .split(" ")
    .slice(0,5) // limit to five words
    .join(" ");
}

function chunkArray(arr, chunkSize) {
  const result = [];
  for (let i = 0; i < arr.length; i += chunkSize) {
    let chunk = arr.slice(i, i + chunkSize);
    result.push(chunk);
  }
  return result;
}

function loadGoogleAPI() {
  (g=>{var h,a,k,p="The Google Maps JavaScript API",c="google",l="importLibrary",q="__ib__",m=document,b=window;b=b[c]||(b[c]={});var d=b.maps||(b.maps={}),r=new Set,e=new URLSearchParams,u=()=>h||(h=new Promise(async(f,n)=>{await (a=m.createElement("script"));e.set("libraries",[...r]+"");for(k in g)e.set(k.replace(/[A-Z]/g,t=>"_"+t[0].toLowerCase()),g[k]);e.set("callback",c+".maps."+q);a.src=`https://maps.${c}apis.com/maps/api/js?`+e;d[q]=f;a.onerror=()=>h=n(Error(p+" could not load."));a.nonce=m.querySelector("script[nonce]")?.nonce||"";m.head.append(a)}));d[l]?console.warn(p+" only loads once. Ignoring:",g):d[l]=(f,...n)=>r.add(f)&&u().then(()=>d[l](f,...n))})({
    key: googleMapsAPIKey,
    v: "weekly"
  });
}