// Flow Report window: draws the numbers that main works out from the stats file.

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function drawChart(perDay) {
  const most = Math.max(1, ...perDay.map((d) => d.words));
  const chart = document.getElementById("chart");
  chart.replaceChildren(
    ...perDay.map(({ day, words }) => {
      const column = element("div", "day");
      const bar = element("div", "bar");
      bar.style.height = `${(words / most) * 100}%`;
      const weekday = new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short" });
      column.append(element("div", "count", words ? words : ""), bar, element("div", "label", weekday));
      return column;
    }),
  );
}

function drawFillers(topFillers) {
  const list = document.getElementById("fillers");
  if (topFillers.length === 0) {
    list.replaceChildren(element("li", "empty", "No filler words yet. Impressive."));
    return;
  }
  list.replaceChildren(
    ...topFillers.map(({ word, count }) => {
      const item = element("li");
      item.append(element("span", "", `“${word}”`), element("span", "count", `${count}×`));
      return item;
    }),
  );
}

async function init() {
  const report = await window.flow.getReport();
  document.getElementById("words").textContent = report.words.toLocaleString("en-GB");
  document.getElementById("wpm").textContent = report.speakingWpm;
  document.getElementById("wpmName").textContent = `words per minute (typing: ~${report.typingWpm})`;
  document.getElementById("saved").textContent = report.minutesSaved;
  drawChart(report.perDay);
  drawFillers(report.topFillers);
}

init();
