(function () {
  var ENDPOINT = "/apps/reviews/list";
  var FILTERS = [
    { value: "all", label: "All" },
    { value: "photos", label: "With photos" },
    { value: "5", label: "5 stars" },
    { value: "4", label: "4 stars" },
    { value: "low", label: "3 stars & below" }
  ];
  var SORTS = [
    { value: "recent", label: "Most recent" },
    { value: "highest", label: "Highest rated" },
    { value: "lowest", label: "Lowest rated" },
    { value: "helpful", label: "Most helpful" }
  ];
  var AVATAR_COLORS = ["#e6e3f7", "#dcebe4", "#fbe4d6", "#dde6f5", "#f3e1e6", "#e8ebd2"];

  // User-er likha text-e HTML thakle seta nirapode dekhanor jonno
  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  function starsHtml(rating) {
    var html = "";
    for (var i = 1; i <= 5; i++) {
      html += '<span class="rvw-star' + (i <= Math.round(rating) ? " on" : "") + '">★</span>';
    }
    return html;
  }

  function initials(name) {
    return String(name || "")
      .split(" ")
      .filter(Boolean)
      .map(function (part) { return part.charAt(0); })
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }

  function avatarColor(name) {
    var sum = 0;
    for (var i = 0; i < name.length; i++) sum += name.charCodeAt(i);
    return AVATAR_COLORS[sum % AVATAR_COLORS.length];
  }

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function init(root) {
    if (root.getAttribute("data-ready")) return;
    root.setAttribute("data-ready", "1");

    var productId = root.getAttribute("data-product-id");
    var shopName = root.getAttribute("data-shop-name");
    var eyebrow = root.getAttribute("data-eyebrow");
    var state = { filter: "all", sort: "recent", q: "", page: 1, loading: false, firstLoad: true };
    var searchTimer = null;

    var filtersHtml = FILTERS.map(function (item) {
      return '<button type="button" class="rvw-pill' + (item.value === "all" ? " active" : "") +
        '" data-filter="' + item.value + '">' + item.label + "</button>";
    }).join("");
    var sortHtml = SORTS.map(function (item) {
      return '<option value="' + item.value + '">' + item.label + "</option>";
    }).join("");

    root.innerHTML =
      '<div class="rvw-eyebrow">' + esc(eyebrow) + "</div>" +
      '<h2 class="rvw-title" data-role="title">Customer reviews</h2>' +
      '<div class="rvw-summary" data-role="summary" hidden></div>' +
      '<div data-role="photos" hidden></div>' +
      '<div class="rvw-controls" data-role="controls" hidden>' +
        '<div class="rvw-filters">' + filtersHtml + "</div>" +
        '<div class="rvw-tools">' +
          '<input type="search" class="rvw-search" placeholder="Search reviews" data-role="search">' +
          '<select class="rvw-sort" data-role="sort">' + sortHtml + "</select>" +
        "</div>" +
      "</div>" +
      '<div class="rvw-list" data-role="list"><div class="rvw-message">Loading reviews...</div></div>' +
      '<div class="rvw-more-wrap" data-role="more-wrap" hidden>' +
        '<button type="button" class="rvw-more" data-role="more">Load more reviews</button>' +
      "</div>";

    var el = {
      title: root.querySelector('[data-role="title"]'),
      summary: root.querySelector('[data-role="summary"]'),
      photos: root.querySelector('[data-role="photos"]'),
      controls: root.querySelector('[data-role="controls"]'),
      list: root.querySelector('[data-role="list"]'),
      moreWrap: root.querySelector('[data-role="more-wrap"]'),
      more: root.querySelector('[data-role="more"]')
    };

    function renderSummary(data) {
      var summary = data.summary;
      el.title.textContent = "Loved by " + summary.total.toLocaleString("en-US") + " customer" + (summary.total === 1 ? "" : "s");

      var rows = [5, 4, 3, 2, 1].map(function (star) {
        var count = summary.counts[star] || 0;
        var percent = summary.total ? (count / summary.total) * 100 : 0;
        return '<div class="rvw-dist-row"><span>' + star + ' ★</span>' +
          '<div class="rvw-track"><div class="rvw-fill" style="width:' + percent + '%"></div></div>' +
          '<span class="rvw-dist-count">' + count + "</span></div>";
      }).join("");

      el.summary.innerHTML =
        '<div class="rvw-card soft">' +
          '<div class="rvw-big">' + summary.average.toFixed(1) + "<span>out of 5</span></div>" +
          '<div class="rvw-stars">' + starsHtml(summary.average) + "</div>" +
          '<div class="rvw-sub">Based on ' + summary.total.toLocaleString("en-US") + " reviews</div>" +
          '<div class="rvw-recommend"><span class="rvw-pct">' + summary.recommendPercent + "%</span>" +
          "<span>of customers would recommend this product</span></div>" +
        "</div>" +
        '<div class="rvw-card">' + rows + "</div>";
      el.summary.hidden = false;
      el.controls.hidden = false;

      if (data.photos.urls.length) {
        var extra = data.photos.total - data.photos.urls.length;
        var tiles = data.photos.urls.map(function (url) {
          return '<div class="rvw-photo"><img src="' + esc(url) + '" alt="Customer photo" loading="lazy"></div>';
        }).join("");
        if (extra > 0) tiles += '<div class="rvw-photo more">+' + extra + "</div>";
        el.photos.innerHTML = '<div class="rvw-photos-title">Photos from customers</div><div class="rvw-photos">' + tiles + "</div>";
        el.photos.hidden = false;
      }
    }

    function reviewHtml(review) {
      var photos = review.photos.length
        ? '<div class="rvw-review-photos">' + review.photos.map(function (url) {
            return '<img src="' + esc(url) + '" alt="Customer photo" loading="lazy">';
          }).join("") + "</div>"
        : "";
      var reply = review.reply
        ? '<div class="rvw-reply"><div class="rvw-reply-label">Reply from ' + esc(shopName) + "</div>" + esc(review.reply) + "</div>"
        : "";
      var variant = review.variantInfo ? '<div class="rvw-variant">' + esc(review.variantInfo) + "</div>" : "";

      return '<article class="rvw-review">' +
        '<div class="rvw-review-top">' +
          '<div class="rvw-avatar" style="background:' + avatarColor(review.customerName) + '">' + esc(initials(review.customerName)) + "</div>" +
          '<div class="rvw-who"><div class="rvw-name">' + esc(review.customerName) + "</div>" +
            (review.verifiedBuyer ? '<div class="rvw-verified">✓ Verified buyer</div>' : "") + "</div>" +
          '<div class="rvw-date">' + formatDate(review.createdAt) + "</div>" +
        "</div>" +
        '<div class="rvw-stars">' + starsHtml(review.rating) + "</div>" +
        '<h3 class="rvw-review-title">' + esc(review.title) + "</h3>" +
        '<p class="rvw-review-body">' + esc(review.body) + "</p>" +
        photos + variant + reply +
        '<div class="rvw-helpful">Helpful (' + review.helpfulCount + ")</div>" +
      "</article>";
    }

    function load(append) {
      if (state.loading) return;
      state.loading = true;
      el.more.disabled = true;

      var params = new URLSearchParams({
        product_id: productId,
        filter: state.filter,
        sort: state.sort,
        q: state.q,
        page: state.page
      });

      fetch(ENDPOINT + "?" + params.toString())
        .then(function (response) {
          if (!response.ok) throw new Error("Request failed");
          return response.json();
        })
        .then(function (data) {
          if (state.firstLoad) {
            state.firstLoad = false;
            if (data.summary.total === 0) {
              el.title.textContent = "Customer reviews";
              el.list.innerHTML = '<div class="rvw-message">No reviews yet.</div>';
              el.moreWrap.hidden = true;
              return;
            }
            renderSummary(data);
          }

          var html = data.reviews.map(reviewHtml).join("");
          if (!append) {
            el.list.innerHTML = html || '<div class="rvw-message">No reviews match your filters.</div>';
          } else {
            el.list.insertAdjacentHTML("beforeend", html);
          }
          el.moreWrap.hidden = !data.pagination.hasMore;
        })
        .catch(function () {
          if (!append) el.list.innerHTML = '<div class="rvw-message">Reviews could not be loaded right now.</div>';
        })
        .then(function () {
          state.loading = false;
          el.more.disabled = false;
        });
    }

    root.addEventListener("click", function (event) {
      var pill = event.target.closest("[data-filter]");
      if (pill) {
        state.filter = pill.getAttribute("data-filter");
        state.page = 1;
        root.querySelectorAll("[data-filter]").forEach(function (button) {
          button.classList.toggle("active", button === pill);
        });
        load(false);
        return;
      }
      if (event.target.closest('[data-role="more"]')) {
        state.page += 1;
        load(true);
      }
    });

    root.addEventListener("input", function (event) {
      if (event.target.getAttribute("data-role") !== "search") return;
      var value = event.target.value.trim();
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        state.q = value;
        state.page = 1;
        load(false);
      }, 350);
    });

    root.addEventListener("change", function (event) {
      if (event.target.getAttribute("data-role") !== "sort") return;
      state.sort = event.target.value;
      state.page = 1;
      load(false);
    });

    load(false);
  }

  function initAll() {
    document.querySelectorAll(".rvw").forEach(init);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAll);
  } else {
    initAll();
  }
  // Theme editor-e block jog ba bodlale
  document.addEventListener("shopify:section:load", initAll);
  document.addEventListener("shopify:block:select", initAll);
})();