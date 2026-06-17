
(function () {
  const DATA = window.TRADE_GINI_DATA || {};
  const METRICS = {
    gini: { label: 'Gini', color: '#0f766e' },
    theil: { label: 'Theil', color: '#2563eb' },
    hhi: { label: 'HHI', color: '#b45309' }
  };
  const COLORS = ['#0f766e', '#2563eb', '#b45309', '#dc2626', '#7c3aed', '#0891b2', '#4d7c0f', '#be123c'];
  const CONFIG = { responsive: true, displayModeBar: true, displaylogo: false };

  function byId(id) { return document.getElementById(id); }
  function currentMetric() { return document.body.dataset.metric || 'gini'; }
  function metricLabel(metric) { return (METRICS[metric] || {}).label || metric; }
  function medianField(metric) { return 'median_' + metric; }
  function fmt(value, digits) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 'n/a';
    return n.toFixed(digits ?? 3);
  }
  function pct(value, digits) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 'n/a';
    return (100 * n).toFixed(digits ?? 1) + '%';
  }
  function layout(title, ytitle, xtitle) {
    return {
      title: { text: title, x: 0, xanchor: 'left', font: { size: 18 } },
      margin: { l: 56, r: 24, t: 54, b: 52 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: '#ffffff',
      hovermode: 'closest',
      xaxis: { title: xtitle || '', gridcolor: '#e5e7eb', zeroline: false },
      yaxis: { title: ytitle || '', gridcolor: '#e5e7eb', zeroline: false },
      legend: { orientation: 'h', y: -0.2 }
    };
  }
  function relayout() {
    document.querySelectorAll('.js-plotly-plot').forEach((node) => Plotly.Plots.resize(node));
  }
  function groupRows(rows, key) {
    const map = new Map();
    rows.forEach((row) => {
      const id = row[key];
      if (!map.has(id)) map.set(id, []);
      map.get(id).push(row);
    });
    return map;
  }

  function renderHubCharts() {
    const trend = byId('hub-trend-chart');
    const latest = byId('hub-latest-chart');
    if (!trend || !latest) return;
    const yearly = DATA.productYearly || [];
    const traces = [];
    ['Exports', 'Imports'].forEach((flow, flowIndex) => {
      Object.keys(METRICS).forEach((metric, index) => {
        const rows = yearly.filter((row) => row.flow === flow).sort((a, b) => Number(a.year) - Number(b.year));
        traces.push({
          type: 'scatter',
          mode: 'lines',
          name: metricLabel(metric) + ' ' + flow,
          x: rows.map((row) => row.year),
          y: rows.map((row) => row[medianField(metric)]),
          line: { color: COLORS[(flowIndex * 3 + index) % COLORS.length], width: 2 }
        });
      });
    });
    Plotly.react(trend, traces, layout('Median product concentration over time', 'Median value', 'Year'), CONFIG);

    const maxYear = Math.max.apply(null, yearly.map((row) => Number(row.year)).filter((value) => Number.isFinite(value)));
    const latestRows = yearly.filter((row) => Number(row.year) === maxYear);
    const barTraces = ['Exports', 'Imports'].map((flow, idx) => ({
      type: 'bar',
      name: flow,
      x: Object.keys(METRICS).map((metric) => metricLabel(metric)),
      y: Object.keys(METRICS).map((metric) => {
        const row = latestRows.find((item) => item.flow === flow);
        return row ? row[medianField(metric)] : null;
      }),
      marker: { color: idx === 0 ? '#0f766e' : '#2563eb' }
    }));
    const latestLayout = layout('Latest median comparison', 'Median value', '');
    latestLayout.barmode = 'group';
    Plotly.react(latest, barTraces, latestLayout, { ...CONFIG, displayModeBar: false });
  }

  function renderMetricOverview() {
    const metric = currentMetric();
    const trend = byId('metric-overview-trend');
    const ranking = byId('metric-overview-ranking');
    const growth = byId('metric-overview-growth');
    const bins = byId('metric-overview-bins');
    const suppliers = byId('metric-overview-suppliers');
    if (trend) {
      const rows = (DATA.productYearly || []).sort((a, b) => Number(a.year) - Number(b.year));
      const traces = ['Exports', 'Imports'].map((flow, idx) => {
        const flowRows = rows.filter((row) => row.flow === flow);
        return {
          type: 'scatter',
          mode: 'lines+markers',
          name: flow,
          x: flowRows.map((row) => row.year),
          y: flowRows.map((row) => row[medianField(metric)]),
          line: { color: idx === 0 ? '#0f766e' : '#2563eb', width: 2 }
        };
      });
      Plotly.react(trend, traces, layout(metricLabel(metric) + ' over time', metricLabel(metric), 'Year'), CONFIG);
    }
    if (ranking) {
      const flow = byId('metric-overview-flow')?.value || 'Exports';
      const rows = (DATA.rankings || []).filter((row) => row.metric === metric && row.flow === flow).slice(0, 15).reverse();
      Plotly.react(ranking, [{
        type: 'bar',
        orientation: 'h',
        x: rows.map((row) => row.metric_value),
        y: rows.map((row) => row.country),
        marker: { color: METRICS[metric].color },
        hovertemplate: '<b>%{y}</b><br>' + metricLabel(metric) + ': %{x:.3f}<extra></extra>'
      }], layout('Latest ' + flow + ' rankings', metricLabel(metric), ''), { ...CONFIG, displayModeBar: false });
    }
    if (growth) {
      const flow = byId('metric-overview-growth-flow')?.value || 'Exports';
      const horizon = Number(byId('metric-overview-growth-horizon')?.value || 5);
      const rows = (DATA.ex12 || []).filter((row) => row.metric === metric && row.flow === flow && Number(row.horizon) === horizon);
      Plotly.react(growth, [{
        type: 'bar',
        x: rows.map((row) => row.base_concentration_bucket),
        y: rows.map((row) => row.mean_annualized_trade_growth_log),
        marker: { color: METRICS[metric].color },
        hovertemplate: '%{x}<br>Trade growth: %{y:.3f}<extra></extra>'
      }], layout('Growth decomposition buckets', 'Mean annualized trade growth', ''), { ...CONFIG, displayModeBar: false });
    }
    if (bins) {
      const rows = DATA.ex03Yearly || [];
      const grouped = groupRows(rows, 'import_bin');
      const traces = Array.from(grouped.entries()).map(([bin, items], idx) => {
        items.sort((a, b) => Number(a.year) - Number(b.year));
        return {
          type: 'scatter',
          mode: 'lines',
          name: bin.replace(/_/g, ' '),
          x: items.map((row) => row.year),
          y: items.map((row) => row[metric]),
          line: { color: COLORS[idx % COLORS.length], width: 2 }
        };
      });
      Plotly.react(bins, traces, layout('Import-bin concentration through time', metricLabel(metric), 'Year'), CONFIG);
    }
    if (suppliers) {
      const rows = (DATA.ex04Yearly || []).sort((a, b) => Number(a.year) - Number(b.year));
      Plotly.react(suppliers, [
        {
          type: 'scatter',
          mode: 'lines',
          name: 'Weighted top supplier share',
          x: rows.map((row) => row.year),
          y: rows.map((row) => row.top_supplier_share),
          line: { color: '#0f766e', width: 2 }
        },
        {
          type: 'scatter',
          mode: 'lines',
          name: 'Weighted source HHI',
          x: rows.map((row) => row.year),
          y: rows.map((row) => row.source_hhi),
          line: { color: '#b45309', width: 2 }
        }
      ], layout('Supplier concentration through time', 'Median value', 'Year'), CONFIG);
    }
  }

  function renderExercise1() {
    const metric = currentMetric();
    const mapNode = byId('exercise1-map');
    const linesNode = byId('exercise1-lines');
    const rankNode = byId('exercise1-ranking');
    const flow = byId('exercise1-flow')?.value || 'Exports';
    const year = Number(byId('exercise1-year')?.value || 2024);
    const rows = (DATA.productPanel || []).filter((row) => row.flow === flow && Number(row.year) === year);
    if (mapNode) {
      Plotly.react(mapNode, [{
        type: 'choropleth',
        locations: rows.map((row) => row.iso3),
        z: rows.map((row) => row[metric]),
        text: rows.map((row) => row.country),
        colorscale: [[0, '#dbeafe'], [0.5, '#60a5fa'], [1, '#0f172a']],
        hovertemplate: '<b>%{text}</b><br>' + metricLabel(metric) + ': %{z:.3f}<extra></extra>'
      }], {
        margin: { l: 0, r: 0, t: 6, b: 0 },
        geo: { projection: { type: 'natural earth' }, showframe: false, showcoastlines: true, bgcolor: 'rgba(0,0,0,0)' },
        paper_bgcolor: 'rgba(0,0,0,0)'
      }, CONFIG);
    }
    if (linesNode) {
      const selected = Array.from(document.querySelectorAll('.exercise1-country-check:checked')).map((el) => el.value);
      const lineRows = (DATA.productPanel || []).filter((row) => row.flow === flow && selected.includes(row.iso3));
      const traces = Array.from(groupRows(lineRows, 'iso3').values()).map((items, idx) => {
        items.sort((a, b) => Number(a.year) - Number(b.year));
        return {
          type: 'scatter',
          mode: 'lines+markers',
          name: items[0].country,
          x: items.map((row) => row.year),
          y: items.map((row) => row[metric]),
          line: { color: COLORS[idx % COLORS.length], width: 2 }
        };
      });
      Plotly.react(linesNode, traces, layout(metricLabel(metric) + ' country trajectories', metricLabel(metric), 'Year'), CONFIG);
    }
    if (rankNode) {
      const rankRows = (DATA.rankings || []).filter((row) => row.metric === metric && row.flow === flow).slice(0, 20).reverse();
      Plotly.react(rankNode, [{
        type: 'bar',
        orientation: 'h',
        x: rankRows.map((row) => row.metric_value),
        y: rankRows.map((row) => row.country),
        marker: { color: METRICS[metric].color }
      }], layout('Latest ' + flow + ' rankings', metricLabel(metric), ''), { ...CONFIG, displayModeBar: false });
    }
  }

  function setupExercise1() {
    const yearSelect = byId('exercise1-year');
    const countryList = byId('exercise1-country-list');
    if (!yearSelect || !countryList) return;
    const years = Array.from(new Set((DATA.productPanel || []).map((row) => Number(row.year)).filter((v) => Number.isFinite(v)))).sort((a, b) => a - b);
    yearSelect.innerHTML = years.map((year) => '<option value="' + year + '">' + year + '</option>').join('');
    yearSelect.value = String(years[years.length - 1] || '');
    const defaults = new Set(['IND', 'USA', 'CHN', 'DEU', 'BRA']);
    countryList.innerHTML = (DATA.countries || []).map((row) => (
      '<label><input class="exercise1-country-check" type="checkbox" value="' + row.iso3 + '"' +
      (defaults.has(row.iso3) ? ' checked' : '') + '> ' + row.country + '</label>'
    )).join('');
    byId('exercise1-country-search')?.addEventListener('input', (event) => {
      const q = String(event.target.value || '').toLowerCase();
      countryList.querySelectorAll('label').forEach((label) => {
        label.style.display = label.textContent.toLowerCase().includes(q) ? 'flex' : 'none';
      });
    });
    byId('exercise1-select-all')?.addEventListener('click', () => {
      countryList.querySelectorAll('input').forEach((el) => { el.checked = true; });
      renderExercise1();
    });
    byId('exercise1-clear-all')?.addEventListener('click', () => {
      countryList.querySelectorAll('input').forEach((el) => { el.checked = false; });
      renderExercise1();
    });
    ['exercise1-flow', 'exercise1-year'].forEach((id) => byId(id)?.addEventListener('change', renderExercise1));
    countryList.addEventListener('change', renderExercise1);
    renderExercise1();
  }

  function renderExercise2() {
    const node = byId('exercise2-growth');
    const node2 = byId('exercise2-products');
    if (!node || !node2) return;
    const metric = currentMetric();
    const flow = byId('exercise2-flow')?.value || 'Exports';
    const horizon = Number(byId('exercise2-horizon')?.value || 5);
    const rows = (DATA.ex02 || []).filter((row) => row.metric === metric && row.flow === flow && Number(row.horizon) === horizon);
    Plotly.react(node, [{
      type: 'bar',
      x: rows.map((row) => row.concentration_bucket),
      y: rows.map((row) => row.mean_annualized_trade_growth_log),
      marker: { color: METRICS[metric].color }
    }], layout('Trade growth by concentration bucket', 'Mean annualized trade growth', ''), { ...CONFIG, displayModeBar: false });
    Plotly.react(node2, [{
      type: 'bar',
      x: rows.map((row) => row.concentration_bucket),
      y: rows.map((row) => row.mean_annualized_product_active_count_growth_log),
      marker: { color: '#b45309' }
    }], layout('Active-product growth by concentration bucket', 'Mean annualized active-product growth', ''), { ...CONFIG, displayModeBar: false });
  }

  function renderExercise3() {
    const metric = currentMetric();
    const trend = byId('exercise3-trend');
    const latest = byId('exercise3-latest');
    if (!trend || !latest) return;
    const grouped = groupRows(DATA.ex03Yearly || [], 'import_bin');
    const traces = Array.from(grouped.entries()).map(([bin, rows], idx) => {
      rows.sort((a, b) => Number(a.year) - Number(b.year));
      return {
        type: 'scatter',
        mode: 'lines',
        name: bin.replace(/_/g, ' '),
        x: rows.map((row) => row.year),
        y: rows.map((row) => row[metric]),
        line: { color: COLORS[idx % COLORS.length], width: 2 }
      };
    });
    Plotly.react(trend, traces, layout('Import-bin concentration over time', metricLabel(metric), 'Year'), CONFIG);
    const latestRows = (DATA.ex03Latest || []).slice().sort((a, b) => Number(b[metric]) - Number(a[metric]));
    Plotly.react(latest, [{
      type: 'bar',
      x: latestRows.map((row) => row.import_bin.replace(/_/g, ' ')),
      y: latestRows.map((row) => row[metric]),
      marker: { color: METRICS[metric].color },
      customdata: latestRows.map((row) => row.median_import_share),
      hovertemplate: '%{x}<br>' + metricLabel(metric) + ': %{y:.3f}<br>Median import share: %{customdata:.1%}<extra></extra>'
    }], layout('Latest-year bin comparison', metricLabel(metric), ''), { ...CONFIG, displayModeBar: false });
  }

  function renderExercise4() {
    const trend = byId('exercise4-trend');
    const latest = byId('exercise4-latest');
    if (!trend || !latest) return;
    const rows = (DATA.ex04Yearly || []).sort((a, b) => Number(a.year) - Number(b.year));
    Plotly.react(trend, [
      { type: 'scatter', mode: 'lines', name: 'Top supplier share', x: rows.map((r) => r.year), y: rows.map((r) => r.top_supplier_share), line: { color: '#0f766e', width: 2 } },
      { type: 'scatter', mode: 'lines', name: 'Source HHI', x: rows.map((r) => r.year), y: rows.map((r) => r.source_hhi), line: { color: '#b45309', width: 2 } }
    ], layout('Supplier dominance over time', 'Median value', 'Year'), CONFIG);
    const latestRows = (DATA.ex04Latest || []).slice(0, 20).reverse();
    Plotly.react(latest, [{
      type: 'bar',
      orientation: 'h',
      x: latestRows.map((r) => r.weighted_mean_top_supplier_share),
      y: latestRows.map((r) => r.country),
      marker: { color: '#0f766e' },
      customdata: latestRows.map((r) => r.weighted_mean_source_hhi),
      hovertemplate: '<b>%{y}</b><br>Top supplier share: %{x:.1%}<br>Source HHI: %{customdata:.3f}<extra></extra>'
    }], layout('Latest highest supplier dominance', 'Top supplier share', ''), { ...CONFIG, displayModeBar: false });
  }

  function renderExercise6() {
    const metric = currentMetric();
    const trend = byId('exercise6-trend');
    const latest = byId('exercise6-sensitivity');
    if (!trend || !latest) return;
    const flow = byId('exercise6-flow')?.value || 'Exports';
    const rows = (DATA.ex06Yearly || []).filter((row) => row.flow === flow);
    const traces = Array.from(groupRows(rows, 'variant').entries()).map(([variant, items], idx) => {
      items.sort((a, b) => Number(a.year) - Number(b.year));
      return {
        type: 'scatter',
        mode: 'lines',
        name: variant,
        x: items.map((row) => row.year),
        y: items.map((row) => row[metric]),
        line: { color: COLORS[idx % COLORS.length], width: 2 }
      };
    });
    Plotly.react(trend, traces, layout(metricLabel(metric) + ' under HS2 exclusions', metricLabel(metric), 'Year'), CONFIG);
    const sens = (DATA.ex06Sensitivity || []).filter((row) => row.flow === flow).slice(0, 20).reverse();
    Plotly.react(latest, [{
      type: 'bar',
      orientation: 'h',
      x: sens.map((row) => row['abs_delta_' + metric]),
      y: sens.map((row) => row.excluded_hs2),
      marker: { color: METRICS[metric].color },
      customdata: sens.map((row) => row.trade_share_removed),
      hovertemplate: 'HS2 %{y}<br>|delta|: %{x:.3f}<br>Removed trade share: %{customdata:.1%}<extra></extra>'
    }], layout('Largest exclusion sensitivities', '|delta|', ''), { ...CONFIG, displayModeBar: false });
  }

  function renderExercise10() {
    const metric = currentMetric();
    const trend = byId('exercise10-trend');
    const latest = byId('exercise10-latest');
    if (!trend || !latest) return;
    const flow = byId('exercise10-flow')?.value || 'Exports';
    const benchmark = byId('exercise10-benchmark')?.value || 'hs2_preserving_within_sector_random_allocation';
    const rows = (DATA.ex10Yearly || []).filter((row) => row.flow === flow && row.benchmark_null === benchmark).sort((a, b) => Number(a.year) - Number(b.year));
    Plotly.react(trend, [
      { type: 'scatter', mode: 'lines', name: 'Actual', x: rows.map((r) => r.year), y: rows.map((r) => r['actual_' + metric]), line: { color: '#0f766e', width: 2 } },
      { type: 'scatter', mode: 'lines', name: 'Sim median', x: rows.map((r) => r.year), y: rows.map((r) => r['sim_' + metric]), line: { color: '#94a3b8', width: 2, dash: 'dash' } }
    ], layout('Actual versus benchmark median', metricLabel(metric), 'Year'), CONFIG);
    const latestRows = (DATA.ex10Latest || []).filter((row) => row.flow === flow && row.benchmark_null === benchmark).slice().sort((a, b) => Number(b['actual_minus_sim_median_' + metric]) - Number(a['actual_minus_sim_median_' + metric])).slice(0, 20).reverse();
    Plotly.react(latest, [{
      type: 'bar',
      orientation: 'h',
      x: latestRows.map((row) => row['actual_minus_sim_median_' + metric]),
      y: latestRows.map((row) => row.country),
      marker: { color: METRICS[metric].color }
    }], layout('Largest benchmark gaps', 'Actual minus simulated median', ''), { ...CONFIG, displayModeBar: false });
  }

  function renderExercise11() {
    const metric = currentMetric();
    const trend = byId('exercise11-trend');
    const latest = byId('exercise11-top');
    if (!trend || !latest) return;
    const flow = byId('exercise11-flow')?.value || 'Exports';
    const rows = (DATA.ex11Yearly || []).filter((row) => row.metric === metric && row.flow === flow).sort((a, b) => Number(a.year) - Number(b.year));
    Plotly.react(trend, [
      { type: 'scatter', mode: 'lines', name: 'Median absolute contribution', x: rows.map((r) => r.year), y: rows.map((r) => r.median_abs_contribution), line: { color: METRICS[metric].color, width: 2 } },
      { type: 'scatter', mode: 'lines', name: 'Max absolute contribution', x: rows.map((r) => r.year), y: rows.map((r) => r.max_abs_contribution), line: { color: '#b45309', width: 2 } }
    ], layout('Leave-one-out contribution scale over time', 'Absolute contribution', 'Year'), CONFIG);
    const topRows = (DATA.ex11Top || []).filter((row) => row.metric === metric && row.flow === flow).slice().reverse();
    Plotly.react(latest, [{
      type: 'bar',
      orientation: 'h',
      x: topRows.map((row) => row.max_abs_contribution),
      y: topRows.map((row) => row.product_label),
      marker: { color: METRICS[metric].color },
      hovertemplate: '<b>%{y}</b><br>Max abs. contribution: %{x:.3f}<extra></extra>'
    }], layout('Top latest product contributors', 'Max absolute contribution', ''), { ...CONFIG, displayModeBar: false });
  }

  function renderExercise12() {
    const metric = currentMetric();
    const growth = byId('exercise12-growth');
    const components = byId('exercise12-components');
    if (!growth || !components) return;
    const flow = byId('exercise12-flow')?.value || 'Exports';
    const horizon = Number(byId('exercise12-horizon')?.value || 5);
    const rows = (DATA.ex12 || []).filter((row) => row.metric === metric && row.flow === flow && Number(row.horizon) === horizon);
    Plotly.react(growth, [{
      type: 'bar',
      x: rows.map((row) => row.base_concentration_bucket),
      y: rows.map((row) => row.mean_annualized_trade_growth_log),
      marker: { color: METRICS[metric].color }
    }], layout('Trade growth by base concentration bucket', 'Mean annualized trade growth', ''), { ...CONFIG, displayModeBar: false });
    Plotly.react(components, [
      { type: 'bar', name: 'Products', x: rows.map((row) => row.base_concentration_bucket), y: rows.map((row) => row.mean_annualized_product_active_count_growth_log), marker: { color: '#0f766e' } },
      { type: 'bar', name: 'Partners', x: rows.map((row) => row.base_concentration_bucket), y: rows.map((row) => row.mean_annualized_partner_active_count_growth_log), marker: { color: '#2563eb' } },
      { type: 'bar', name: 'Cells', x: rows.map((row) => row.base_concentration_bucket), y: rows.map((row) => row.mean_annualized_cell_active_count_growth_log), marker: { color: '#b45309' } }
    ], Object.assign(layout('Growth decomposition components', 'Mean annualized growth', ''), { barmode: 'group' }), { ...CONFIG, displayModeBar: false });
  }

  function renderTheilAppendix() {
    const node = byId('theil-appendix-chart');
    if (!node) return;
    const rows = (DATA.appendixYearly || []).sort((a, b) => Number(a.year) - Number(b.year));
    Plotly.react(node, [
      { type: 'scatter', mode: 'lines', name: 'Exports', x: rows.filter((r) => r.flow === 'Exports').map((r) => r.year), y: rows.filter((r) => r.flow === 'Exports').map((r) => r.theil), line: { color: '#2563eb', width: 2 } },
      { type: 'scatter', mode: 'lines', name: 'Imports', x: rows.filter((r) => r.flow === 'Imports').map((r) => r.year), y: rows.filter((r) => r.flow === 'Imports').map((r) => r.theil), line: { color: '#0f766e', width: 2 } }
    ], layout('Median product-destination Theil over time', 'Median Theil', 'Year'), CONFIG);
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderHubCharts();
    renderMetricOverview();
    setupExercise1();
    renderExercise2();
    renderExercise3();
    renderExercise4();
    renderExercise6();
    renderExercise10();
    renderExercise11();
    renderExercise12();
    renderTheilAppendix();
    ['metric-overview-flow', 'metric-overview-growth-flow', 'metric-overview-growth-horizon', 'exercise2-flow', 'exercise2-horizon', 'exercise6-flow', 'exercise10-flow', 'exercise10-benchmark', 'exercise11-flow', 'exercise12-flow', 'exercise12-horizon']
      .forEach((id) => byId(id)?.addEventListener('change', () => {
        renderMetricOverview();
        renderExercise2();
        renderExercise6();
        renderExercise10();
        renderExercise11();
        renderExercise12();
      }));
    window.addEventListener('resize', relayout);
  });
})();
