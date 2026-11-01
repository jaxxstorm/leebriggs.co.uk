// Dark mode icon
function switch_dark_mode_icon(darkmode, id) {
  darkmode.toggle();
  render_dark_mode_icon(darkmode, id);
}

function render_dark_mode_icon(darkmode, id) {
  var x = document.getElementsByTagName("img");
  var i;

  if (darkmode.isActivated()) {
    document.getElementById(id).classList.remove("fa-sun");
    document.getElementById(id).classList.add("fa-moon");
    for (i = 0; i < x.length; i++) {
      x[i].style["mix-blend-mode"] = "difference";
    }
  } else {
    document.getElementById(id).classList.remove("fa-moon");
    document.getElementById(id).classList.add("fa-sun");
    for (i = 0; i < x.length; i++) {
      x[i].style["mix-blend-mode"] = "normal";
    }
  }
}

// Modal link
document.addEventListener('DOMContentLoaded', function() {
    if (window.hljs) {
      window.hljs.highlightAll();
    }
    var id = window.location.hash.slice(1);
    var modal = id && document.getElementById(id);
    if (modal && modal.classList.contains('modal') && window.bootstrap) {
      window.bootstrap.Modal.getOrCreateInstance(modal).show();
    }
});
