import './style.styl';
import typescriptLogo from '@/assets/typescript.svg';
import viteLogo from '/wxt.svg';
import { setupCounter } from '@/components/counter';


document.querySelector<HTMLDivElement>('#topbar')!.innerHTML = `
	<div class="tab-bg"></div>
	<button>tools</button>
	<button>ui</button>
	<button>settings</button>
	<button>ℹ️</button>`;

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
	<a href="https://aa-saleseng-us-4sbx.cloud.automationanywhere.digital/#/dashboard/home" target="_blank">
	  <img src="${viteLogo}" class="logo" alt="WXT logo" />
	</a>
	<a href="https://aa-saleseng-us-4sbx.cloud.automationanywhere.digital/#/dashboard/home" target="_blank">
	  <img src="${typescriptLogo}" class="logo vanilla" alt="TypeScript logo" />
	</a>
	<h2>WXT + TypeScript</h2>
	<div class="card">
	  <button id="counter" type="button"></button>
	</div>
	<p class="read-the-docs">
	  Click on the WXT and TypeScript logos to learn more
	  <h2>
		<a href='https://aa-saleseng-us-4sbx.cloud.automationanywhere.digital/#/dashboard/home' target="_blank">
		 goto control room
		</a>
	 </h2>
	</p>
  </div>`;

setupCounter(document.querySelector<HTMLButtonElement>('#counter')!);

// tabs logic
function updateTabBg() {
	const topbar = document.getElementById("topbar");
	if (!topbar) return;
	const tabBg = topbar.querySelector<HTMLDivElement>(".tab-bg");
	if (!tabBg) return;
	const buttons = Array.from(
		topbar.querySelectorAll<HTMLButtonElement>("button:not(:last-child)")
	);
	const activeBtn = buttons.find((btn) => btn.classList.contains("active"));
	if (!activeBtn) {
		tabBg.style.width = "0px";
		return;
	}
	const btnRect = activeBtn.getBoundingClientRect();
	const barRect = topbar.getBoundingClientRect();
	tabBg.style.left = `${btnRect.left - barRect.left}px`;
	tabBg.style.width = `${btnRect.width}px`;
}
function setActive(index: number) {
	const topbar = document.getElementById("topbar");
	if (!topbar) return;
	const buttons = Array.from(
		topbar.querySelectorAll<HTMLButtonElement>("button:not(:last-child)")
	);
	buttons.forEach((btn, i) => {
		btn.classList.toggle("active", i === index);
	});
	updateTabBg();
}

const views = ["tools.html", "ui.html", "settings.html", "about.html"];

function setupTopbarTabs() {
	const topbar = document.getElementById("topbar");
	if (!topbar) return;
	const buttons = Array.from(
		topbar.querySelectorAll<HTMLButtonElement>("button")
	);

	buttons.forEach((btn, idx) => {
		btn.addEventListener("click", () => {
			setActive(idx);
			loadView(views[idx]);
		});
	});
	window.addEventListener("resize", updateTabBg);
	updateTabBg();
}

async function loadView(filename: string) {
	const url = browser.runtime.getURL(`/${filename}`);
	try {
		const res = await fetch(url);
		if (!res.ok) throw new Error(`${url}: ${res.status} ${res.statusText}`);
		const html = await res.text();
		document.querySelector<HTMLDivElement>('#app')!.innerHTML = html;
	} catch (e) {
		document.querySelector<HTMLDivElement>('#app')!.innerHTML =
			`<div style="padding:2em;color:red">Error loading ${filename}:<br>${e}</div>`;
		console.error("Failed to load", filename, e);
	}
}

document.addEventListener("DOMContentLoaded", () => {
	setActive(0);
	setupTopbarTabs();
	loadView("tools.html");
});



