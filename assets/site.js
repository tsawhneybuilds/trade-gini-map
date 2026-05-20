
(function () {
  const DATA = window.TRADE_GINI_DATA || {};
  const COLORS = ['#0f766e', '#2563eb', '#b7791f', '#dc2626', '#7c3aed', '#0891b2', '#4d7c0f', '#be123c', '#4338ca', '#a16207', '#0f172a', '#ea580c'];
  const config = { responsive: true, displayModeBar: true, displaylogo: false };

  function fmt(value, digits = 3) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return 'n/a';
    return Number(value).toFixed(digits);
  }

  function pct(value, digits = 1) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return 'n/a';
    return (100 * Number(value)).toFixed(digits) + '%';
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function relayout() {
    document.querySelectorAll('.js-plotly-plot').forEach((node) => Plotly.Plots.resize(node));
  }

  function layout(title, ytitle) {
    return {
      title: { text: title, x: 0, xanchor: 'left', font: { size: 18 } },
      margin: { l: 56, r: 24, t: 52, b: 48 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: '#ffffff',
      hovermode: 'closest',
      xaxis: { gridcolor: '#e5e7eb', zeroline: false },
      yaxis: { title: ytitle || '', gridcolor: '#e5e7eb', zeroline: false },
      legend: { orientation: 'h', y: -0.2 }
    };
  }

  function rowsFor(flow, metric, year) {
    return (DATA.exercise1?.panel || []).filter((row) => row.flow === flow && Number(row.year) === Number(year) && row[metric] !== null);
  }

  function selectedCountries() {
    return Array.from(document.querySelectorAll('.country-check:checked')).map((el) => el.value);
  }

  function setDetail(row, metric) {
    const box = byId('line-detail');
    if (!box || !row) return;
    box.innerHTML = '<strong>' + row.country + '</strong> (' + row.iso3 + '), ' + row.year + ' ' + row.flow +
      '<br>' + (DATA.labels?.metrics?.[metric] || metric) + ': ' + fmt(row[metric]) +
      '<br>Product Gini: ' + fmt(row.product_gini) +
      ' | Partner Gini: ' + fmt(row.partner_gini) +
      ' | Cell Gini: ' + fmt(row.product_partner_cell_gini);
  }

  function renderMap() {
    const node = byId('world-map');
    if (!node) return;
    const flow = byId('map-flow').value;
    const metric = byId('map-metric').value;
    const year = byId('map-year').value;
    const rows = rowsFor(flow, metric, year);
    const trace = {
      type: 'choropleth',
      locations: rows.map((r) => r.iso3),
      z: rows.map((r) => r[metric]),
      text: rows.map((r) => r.country),
      customdata: rows,
      colorscale: [
        [0, '#e0f2fe'],
        [0.5, '#2dd4bf'],
        [1, '#0f172a']
      ],
      colorbar: { title: DATA.labels?.metrics?.[metric] || metric },
      marker: { line: { color: '#ffffff', width: 0.4 } },
      hovertemplate: '<b>%{text}</b><br>Gini: %{z:.3f}<extra></extra>'
    };
    Plotly.react(node, [trace], {
      margin: { l: 0, r: 0, t: 10, b: 0 },
      geo: {
        projection: { type: 'natural earth' },
        showframe: false,
        showcoastlines: true,
        coastlinecolor: '#94a3b8',
        bgcolor: 'rgba(0,0,0,0)'
      },
      paper_bgcolor: 'rgba(0,0,0,0)'
    }, config);
    node.on('plotly_click', (event) => {
      const row = event.points?.[0]?.customdata;
      if (!row) return;
      const check = document.querySelector('.country-check[value="' + row.iso3 + '"]');
      if (check) check.checked = true;
      setDetail(row, metric);
      renderLines();
    });
  }

  function renderCountryList() {
    const list = byId('country-checkboxes');
    if (!list) return;
    const selectedDefaults = new Set(['IND', 'USA', 'CHN', 'DEU', 'JPN']);
    list.innerHTML = '';
    (DATA.countries || []).forEach((country) => {
      const label = document.createElement('label');
      label.dataset.country = (country.country || '').toLowerCase();
      label.dataset.iso3 = country.iso3;
      label.innerHTML = '<input class="country-check" type="checkbox" value="' + country.iso3 + '"' +
        (selectedDefaults.has(country.iso3) ? ' checked' : '') + '> ' + country.country;
      list.appendChild(label);
    });
    list.addEventListener('change', renderLines);
  }

  function filterCountryList() {
    const query = (byId('country-search')?.value || '').toLowerCase();
    document.querySelectorAll('#country-checkboxes label').forEach((label) => {
      const match = label.dataset.country.includes(query) || label.dataset.iso3.toLowerCase().includes(query);
      label.style.display = match ? 'flex' : 'none';
    });
  }

  function renderLines() {
    const node = byId('country-lines');
    if (!node) return;
    const flow = byId('line-flow').value;
    const metric = byId('line-metric').value;
    const selected = selectedCountries();
    const rows = (DATA.exercise1?.panel || []).filter((row) => row.flow === flow && selected.includes(row.iso3));
    const grouped = new Map();
    rows.forEach((row) => {
      if (!grouped.has(row.iso3)) grouped.set(row.iso3, []);
      grouped.get(row.iso3).push(row);
    });
    const traces = Array.from(grouped.entries()).map(([iso3, group], index) => {
      group.sort((a, b) => Number(a.year) - Number(b.year));
      return {
        type: 'scatter',
        mode: 'lines+markers',
        name: group[0]?.country || iso3,
        x: group.map((r) => r.year),
        y: group.map((r) => r[metric]),
        customdata: group,
        line: { color: COLORS[index % COLORS.length], width: 2 },
        marker: { size: 5 },
        hovertemplate: '<b>%{fullData.name}</b><br>%{x}: %{y:.3f}<extra></extra>'
      };
    });
    Plotly.react(node, traces, layout((DATA.labels?.metrics?.[metric] || metric) + ' over time', 'Gini'), config);
    node.on('plotly_click', (event) => {
      const row = event.points?.[0]?.customdata;
      setDetail(row, metric);
    });
  }

  function setupExtension() {
    const years = Array.from(new Set((DATA.exercise1?.panel || []).map((row) => row.year))).sort((a, b) => a - b);
    const yearSelect = byId('map-year');
    years.forEach((year) => {
      const option = document.createElement('option');
      option.value = year;
      option.textContent = year;
      if (year === Math.max(...years)) option.selected = true;
      yearSelect.appendChild(option);
    });
    renderCountryList();
    ['map-flow', 'map-metric', 'map-year'].forEach((id) => byId(id)?.addEventListener('change', renderMap));
    ['line-flow', 'line-metric'].forEach((id) => byId(id)?.addEventListener('change', renderLines));
    byId('country-search')?.addEventListener('input', filterCountryList);
    byId('select-all-countries')?.addEventListener('click', () => {
      document.querySelectorAll('.country-check').forEach((el) => { el.checked = true; });
      renderLines();
    });
    byId('clear-countries')?.addEventListener('click', () => {
      document.querySelectorAll('.country-check').forEach((el) => { el.checked = false; });
      renderLines();
    });
    renderMap();
    renderLines();
    renderExclusionChart();
    renderBenchmarkChart();
  }

  function renderExclusionChart() {
    const node = byId('exclusion-chart');
    if (!node) return;
    const rows = DATA.exercise6?.median_by_variant || [];
    const trace = {
      type: 'bar',
      x: rows.map((r) => r.label),
      y: rows.map((r) => r.product_gini),
      marker: { color: '#0f766e' },
      hovertemplate: '%{x}<br>Median product Gini: %{y:.3f}<extra></extra>'
    };
    Plotly.react(node, [trace], layout('Median export product Gini after lumpy-product exclusions', 'Gini'), config);
  }

  function renderBenchmarkChart() {
    const node = byId('benchmark-chart');
    if (!node) return;
    const rows = DATA.exercise10?.benchmark_ladder || [];
    const traces = ['Exports', 'Imports'].map((flow, index) => {
      const flowRows = rows.filter((r) => r.flow === flow);
      return {
        type: 'bar',
        name: flow,
        x: flowRows.map((r) => r.benchmark),
        y: flowRows.map((r) => r.gap),
        marker: { color: COLORS[index] },
        hovertemplate: flow + '<br>%{x}<br>Actual minus benchmark: %{y:.3f}<extra></extra>'
      };
    });
    const chartLayout = layout('How far actual product Ginis sit above random benchmarks', 'Actual minus benchmark Gini');
    chartLayout.barmode = 'group';
    Plotly.react(node, traces, chartLayout, config);
  }

  function setupImports() {
    renderImportBins();
    renderSupplierChart();
    renderIoChart();
  }

  function renderImportBins() {
    const node = byId('import-bin-chart');
    if (!node) return;
    const rows = DATA.exercise3?.bin_summary || [];
    const traces = [
      { name: 'Product Gini', y: rows.map((r) => r.product_gini), marker: { color: '#0f766e' } },
      { name: 'Top-1 product share', y: rows.map((r) => r.top_1_product_share), marker: { color: '#b7791f' } },
      { name: 'Import value share', y: rows.map((r) => r.import_value_share), marker: { color: '#2563eb' } }
    ].map((trace) => ({
      type: 'bar',
      name: trace.name,
      x: rows.map((r) => r.label),
      y: trace.y,
      marker: trace.marker,
      hovertemplate: trace.name + '<br>%{x}: %{y:.3f}<extra></extra>'
    }));
    const chartLayout = layout('Import bins: concentration versus scale', 'Share or Gini');
    chartLayout.barmode = 'group';
    Plotly.react(node, traces, chartLayout, config);
  }

  function renderSupplierChart() {
    const node = byId('supplier-chart');
    if (!node) return;
    const rows = DATA.exercise4?.year_series || [];
    const traces = [
      ['median_top_supplier_share', 'Median top-supplier share', '#0f766e'],
      ['share_products_top_supplier_ge_75', 'Share of products with top supplier >=75%', '#b7791f'],
      ['import_value_share_products_top_supplier_ge_75', 'Import value share in >=75% rows', '#2563eb']
    ].map(([key, name, color]) => ({
      type: 'scatter',
      mode: 'lines+markers',
      name,
      x: rows.map((r) => r.year),
      y: rows.map((r) => r[key]),
      line: { color, width: 2 },
      hovertemplate: name + '<br>%{x}: %{y:.3f}<extra></extra>'
    }));
    Plotly.react(node, traces, layout('Dominant supplier measures over time', 'Share'), config);
  }

  function renderIoChart() {
    const node = byId('io-chart');
    if (!node) return;
    const rows = DATA.exercise11?.year_series || [];
    const traces = [
      ['weighted_top_sector_input_product_gini', 'Top-sector input product Gini', '#0f766e'],
      ['weighted_top_sector_top_supplier_share', 'Top-sector top-supplier share', '#b7791f'],
      ['median_top_sector_matched_requirement_share', 'Matched requirement share', '#2563eb']
    ].map(([key, name, color]) => ({
      type: 'scatter',
      mode: 'lines+markers',
      name,
      x: rows.map((r) => r.year),
      y: rows.map((r) => r[key]),
      line: { color, width: 2 },
      hovertemplate: name + '<br>%{x}: %{y:.3f}<extra></extra>'
    }));
    Plotly.react(node, traces, layout('Top export sector imported-input exposure', 'Share or Gini'), config);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const page = document.body.dataset.page;
    if (page === 'extension') setupExtension();
    if (page === 'imports') setupImports();
    window.addEventListener('resize', relayout);
  });
})();
