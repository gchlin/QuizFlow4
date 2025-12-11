(async function () {
  const params = new URLSearchParams(window.location.search);
  const themeName = params.get('theme');
  if (!themeName) {
    alert('請從主選單選擇主題');
    window.location.href = 'index.html';
    return;
  }

  const loader = new ThemeLoader();

  try {
    const raw = await loader.loadTheme(themeName);
    const normalized = normalizeThemeData(themeName, raw);

    // 若主題有自訂 CSS，套用
    if (normalized.theme.gameDisplay?.useCustomCSS && normalized.theme.gameDisplay.customCSSPath) {
      const link = document.getElementById('customThemeCSS');
      if (link) link.href = `themes/${themeName}/${normalized.theme.gameDisplay.customCSSPath}`;
    }

    window.Game = new GameEngine(normalized);
    console.log('[game.js] GameEngine ready', normalized);
  } catch (err) {
    console.error('載入主題失敗:', err);
    alert(`主題載入失敗: ${err.message || err}`);
    window.location.href = 'index.html';
  }

  function normalizeThemeData(themeName, data) {
    const basePath = `themes/${themeName}/`;
    const theme = normalizeTheme(themeName, data.theme || {});
    const config = data.config || {};
    const questions = normalizeQuestions(basePath, data.questions || {});
    return { basePath, theme, config, questions };
  }

  function normalizeTheme(themeName, theme) {
    const meta = theme.meta || theme.metadata || { name: themeName };
    const colors = theme.colors || theme.gameDisplay?.colors || {
      player1: '#FF6B6B',
      player2: '#4ECDC4',
      background: '#f7f9fc',
      correct: '#2ecc71',
      wrong: '#e74c3c'
    };

    // 依模式指定選項格線，預設都是 2x2
    const optionGrid = (theme.layout && theme.layout.optionGrid && typeof theme.layout.optionGrid === 'object')
      ? theme.layout.optionGrid
      : { practice: '2x2', versus: '2x2', speed: '2x2', duel: '2x2' };

    const layout = { ...(theme.layout || {}), optionGrid };

    const messages = {
      warning: theme.messages?.warning || { triggerTime: 5, text: '倒數' },
      combo: theme.messages?.combo || { minCount: 2, text: 'COMBO' },
      penalty: theme.messages?.penalty || { threshold: 2, scoreDeduction: -2, text: '破音' },
      win: theme.messages?.win || ['WIN'],
      lose: theme.messages?.lose || ['LOSE'],
      draw: theme.messages?.draw || ['DRAW']
    };

    const features = theme.features || { soundEffects: true };

    return { ...theme, meta, colors, layout, messages, features };
  }

  function normalizeQuestions(basePath, qdata) {
    const pools = {};
    Object.entries(qdata.answerPools || {}).forEach(([poolId, pool]) => {
      const items = (pool.items || []).map(item => ({
        id: item.id,
        type: pool.type || item.type || 'text',
        content: item.content || item.text || item.value || '',
        category: pool.category || 'default'
      }));
      pools[poolId] = {
        name: pool.name || poolId,
        type: pool.type || 'text',
        category: pool.category || 'default',
        items
      };
    });

    const sets = {};
    Object.entries(qdata.questionSets || {}).forEach(([setId, set]) => {
      const qs = Array.isArray(set.questions) ? set.questions : Array.isArray(set) ? set : [];
      const answerPoolIds = set.answerPoolIds || [];
      const questions = qs.map((q, idx) => ({
        id: q.id || `${setId}_${idx + 1}`,
        type: q.type || q.question?.type || 'text',
        content: q.content || q.question?.value || q.question?.content || '',
        correctAnswer: q.correctAnswer || q.correctAnswerId || q.aKey || '',
        answerPoolIds: q.answerPoolIds || answerPoolIds
      }));
      sets[setId] = {
        name: set.name || setId,
        answerPoolIds,
        questions
      };
    });

    const referenceTable = (qdata.referenceTable || []).map(row => ({
      ...row,
      image: row.image ? basePath + row.image : row.image
    }));

    return { answerPools: pools, questionSets: sets, referenceTable };
  }
})();
