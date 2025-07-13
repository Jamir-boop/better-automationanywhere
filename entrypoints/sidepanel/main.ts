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
        <a href='https://aa-saleseng-us-4sbx.cloud.automationanywhere.digital/#/dashboard/home' target="_blank>
         goto control room
        </a>
     </h2>
    </p>
  </div>`;

setupCounter(document.querySelector<HTMLButtonElement>('#counter')!);


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
function setupTopbarTabs() {
	const topbar = document.getElementById("topbar");
	if (!topbar) return;
	const buttons = Array.from(
		topbar.querySelectorAll<HTMLButtonElement>("button:not(:last-child)")
	);
	buttons.forEach((btn, idx) => {
		btn.addEventListener("click", () => setActive(idx));
	});
	window.addEventListener("resize", updateTabBg);
	updateTabBg();
}
document.addEventListener("DOMContentLoaded", setupTopbarTabs);