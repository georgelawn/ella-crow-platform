(function () {
  const mobileQuery = window.matchMedia("(max-width: 480px)");

  function buttonText(panel, expanded) {
    const heading = panel.querySelector(".panel-heading h2")?.textContent?.trim() || "Add";
    return `${expanded ? "Hide" : "Open"} ${heading}`;
  }

  function setPanelState(panel, expanded) {
    const button = panel.querySelector(".mobile-panel-toggle");
    panel.classList.toggle("mobile-panel-open", expanded);
    document.body.classList.toggle("mobile-panel-overlay-active", expanded && panel.classList.contains("overlay-panel"));
    if (button) {
      button.setAttribute("aria-expanded", String(expanded));
      button.textContent = buttonText(panel, expanded);
    }
  }

  function syncForViewport(panel) {
    if (mobileQuery.matches || panel.classList.contains("overlay-panel")) {
      setPanelState(panel, false);
    } else {
      setPanelState(panel, true);
    }
  }

  function setupPanel(panel) {
    const form = panel.querySelector("form");
    if (!form || panel.querySelector(".mobile-panel-toggle")) return;

    const button = document.createElement("button");
    button.className = "mobile-panel-toggle";
    button.type = "button";
    button.setAttribute("aria-controls", form.id || "");
    button.addEventListener("click", () => {
      setPanelState(panel, !panel.classList.contains("mobile-panel-open"));
    });

    form.before(button);
    form.addEventListener("submit", () => {
      if (mobileQuery.matches || panel.classList.contains("overlay-panel")) setPanelState(panel, false);
    });
    syncForViewport(panel);
  }

  function setup() {
    document.querySelectorAll(".control-panel").forEach(setupPanel);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup);
  } else {
    setup();
  }

  mobileQuery.addEventListener("change", () => {
    document.querySelectorAll(".control-panel").forEach(syncForViewport);
  });
})();
