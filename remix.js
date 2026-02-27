(function () {
  var saveKey = 'notQuiteCookieClickerSave';

  function format(value) {
    if (window.Game && typeof Game.Beautify === 'function') {
      return Game.Beautify(Math.floor(value));
    }
    return Math.floor(value).toString();
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(saveKey);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }

  function saveState(state) {
    try {
      localStorage.setItem(saveKey, JSON.stringify(state));
    } catch (error) {
      // Ignore storage failures.
    }
  }

  function boot() {
    if (!window.Game || !Game.ready) {
      setTimeout(boot, 300);
      return;
    }

    document.title = 'Not Quite Cookie Clicker';
    var topTitle = document.querySelector('#topBar b');
    if (topTitle) {
      topTitle.textContent = 'Not Quite Cookie Clicker';
    }

    var supportComment = document.getElementById('supportComment');
    if (supportComment) {
      supportComment.textContent = 'Fuel this weird little bakery experiment!';
    }

    var state = Object.assign(
      {
        crumbs: 0,
        combos: 0,
        bestCombo: 0,
        lastClickAt: 0,
        passiveBakers: 0,
        fulfilledMissions: {},
        lifetimeCrumbs: 0,
      },
      loadState() || {}
    );

    var missions = [
      {
        id: 'first1000',
        label: 'Bake 1,000 cookies',
        target: function () {
          return 1000;
        },
        progress: function () {
          return Game.cookiesEarned;
        },
        reward: 15,
      },
      {
        id: 'combo10',
        label: 'Reach a 10-click combo',
        target: function () {
          return 10;
        },
        progress: function () {
          return state.bestCombo;
        },
        reward: 30,
      },
      {
        id: 'build20',
        label: 'Own 20 buildings total',
        target: function () {
          return 20;
        },
        progress: function () {
          var total = 0;
          for (var i = 0; i < Game.ObjectsById.length; i++) total += Game.ObjectsById[i].amount;
          return total;
        },
        reward: 60,
      },
    ];

    var panel = document.createElement('div');
    panel.id = 'nq-panel';
    panel.className = 'inset title';
    panel.innerHTML = [
      '<div class="nq-header">Not Quite Lab</div>',
      '<div id="nq-crumbs" class="nq-stat"></div>',
      '<div id="nq-combo" class="nq-stat"></div>',
      '<div id="nq-passive" class="nq-stat"></div>',
      '<div class="nq-actions">',
      '<button id="nq-burst" class="nq-btn">25 crumbs: Burst Batch</button>',
      '<button id="nq-baker" class="nq-btn">100 crumbs: Recruit Street Baker</button>',
      '</div>',
      '<div id="nq-missions" class="nq-missions"></div>',
    ].join('');

    var middle = document.getElementById('sectionMiddle');
    var comments = document.getElementById('comments');
    if (middle && comments) {
      middle.insertBefore(panel, comments.nextSibling);
    }

    function spend(cost) {
      if (state.crumbs < cost) {
        Game.Notify('Not enough crumbs', 'You need ' + format(cost) + ' crumbs.', [16, 5]);
        return false;
      }
      state.crumbs -= cost;
      return true;
    }

    function earnCrumbs(amount) {
      state.crumbs += amount;
      state.lifetimeCrumbs += amount;
    }

    document.getElementById('nq-burst').addEventListener('click', function () {
      if (!spend(25)) return;
      var burst = Math.max(50, Game.cookiesPs * 30 + Game.computedMouseCps * 100);
      Game.Earn(burst);
      Game.Notify('Burst Batch!', '+' + format(burst) + ' cookies from a rogue recipe.', [0, 0]);
    });

    document.getElementById('nq-baker').addEventListener('click', function () {
      if (!spend(100)) return;
      state.passiveBakers += 1;
      Game.Notify('Street Baker hired', 'Passive bakers now: ' + state.passiveBakers + '.', [1, 0]);
    });

    var bigCookie = document.getElementById('bigCookie');
    if (bigCookie) {
      bigCookie.addEventListener('click', function () {
        var now = Date.now();
        if (now - state.lastClickAt < 1200) {
          state.combos += 1;
        } else {
          state.combos = 1;
        }
        state.lastClickAt = now;
        state.bestCombo = Math.max(state.bestCombo, state.combos);

        var bonus = Math.max(1, Math.floor(Game.computedMouseCps * 0.25 * state.combos));
        Game.Earn(bonus);
        earnCrumbs(1 + Math.floor(state.combos / 8));
      });
    }

    function renderMissions() {
      var lines = missions.map(function (mission) {
        var progress = Math.min(mission.progress(), mission.target());
        var done = !!state.fulfilledMissions[mission.id];
        if (!done && progress >= mission.target()) {
          state.fulfilledMissions[mission.id] = true;
          earnCrumbs(mission.reward);
          Game.Notify('Mission cleared!', mission.label + ' (+' + mission.reward + ' crumbs)', [11, 4]);
          done = true;
        }

        return (
          '<div class="nq-mission ' +
          (done ? 'done' : '') +
          '">' +
          mission.label +
          ' - ' +
          format(progress) +
          '/' +
          format(mission.target()) +
          (done ? ' ✓' : '') +
          '</div>'
        );
      });
      document.getElementById('nq-missions').innerHTML = lines.join('');
    }

    function tick() {
      var passiveGain = state.passiveBakers * Math.max(1, Game.computedMouseCps * 0.5);
      if (passiveGain > 0) {
        Game.Earn(passiveGain);
      }

      earnCrumbs(Math.max(0.2, Game.cookiesPs / 1200));
      state.combos = Date.now() - state.lastClickAt > 1500 ? 0 : state.combos;

      document.getElementById('nq-crumbs').textContent =
        'Crumbs: ' + format(state.crumbs) + ' (lifetime ' + format(state.lifetimeCrumbs) + ')';
      document.getElementById('nq-combo').textContent =
        'Combo: x' + state.combos + ' (best x' + state.bestCombo + ')';
      document.getElementById('nq-passive').textContent =
        'Street bakers: ' + state.passiveBakers + ' (+' + format(passiveGain) + ' cookies/sec)';
      renderMissions();
      saveState(state);
    }

    tick();
    setInterval(tick, 1000);
  }

  boot();
})();
