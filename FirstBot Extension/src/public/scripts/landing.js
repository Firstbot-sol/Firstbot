document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get(
    ["bloom.token", "bloom.expires_at"],
    function (result) {
      const token = result["bloom.token"];
      const expiresAt = result["bloom.expires_at"];
      const currentTime = Date.now();

      if (token && expiresAt && currentTime < expiresAt) {
        smoothRedirect("popup.html");
      } else {
        const getCodeBtn = document.getElementById("getCodeBtn");
        getCodeBtn.addEventListener("click", getCode);

        document
          .querySelector(".sender")
          .addEventListener("click", function () {
            const code = document.querySelector(".code-input").value;

            function showError(message) {
              let errorElem = document.getElementById("errorMessage");
              if (!errorElem) {
                errorElem = document.createElement("div");
                errorElem.id = "errorMessage";
                errorElem.style.cssText =
                  "position: absolute; bottom: 0; width: 100%; text-align: center; color: red; margin-bottom: 8px;";
                document.body.appendChild(errorElem);
              }
              errorElem.textContent = message;
            }

            if (!code) {
              showError("Click the Buy NFT button to buy NFT Pass.");
              return;
            }

            fetch(`https://extension.bloombot.app/auth`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ code }),
            })
              .then((response) => response.json())
              .then((data) => {
                if (data.token && data.expires_at) {
                  chrome.storage.local.set(
                    Object.fromEntries(
                      Object.entries(data).map(([key, value]) => [
                        "bloom." + key,
                        value,
                      ]),
                    ),
                    function () {
                      chrome.action.setPopup({ popup: "popup.html" });
                      smoothRedirect("popup.html");
                    },
                  );
                } else if (data.error) {
                  showError("An error occurred while verifying your wallet");
                }
              })
              .catch((error) => {
                showError("An error occurred while verifying your wallet");
              });
          });
      }
    },
  );
});

function getCode() {
  window.open(
    "https://presale.magiceden.io/pay/67b0c7e6cc9e55265700c3bb",
    "_blank",
  );
}

function smoothRedirect(url) {
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "document";
  link.href = url;
  document.head.appendChild(link);

  document.body.style.opacity = "0";
  document.body.style.transition = "opacity 0.2s ease";

  setTimeout(() => {
    window.location.href = url;
  }, 200);
}
