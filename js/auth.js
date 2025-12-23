alaert("auth.js loaded");
document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("loginForm");

    if (!form) return;

    form.addEventListener("submit", function (e) {
        e.preventDefault(); // stop page reload

        // TEMP: assume login is successful
        window.location.href = "dashboard.html";
    });
});
