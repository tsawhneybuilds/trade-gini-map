
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

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function relayout() {
    document.querySelectorAll('.js-plotly-plot').forEach((node) => Plotly.Plots.resize(node));
  }

  function setupSortableTables() {
    document.querySelectorAll('table[data-sortable]').forEach((table) => {
      table.querySelectorAll('.sort-header').forEach((button) => {
        button.addEventListener('click', () => {
          const index = Number(button.dataset.sortIndex);
          const type = button.dataset.sortType || 'text';
          const nextDir = table.dataset.sortIndex === String(index) && table.dataset.sortDir === 'asc' ? 'desc' : 'asc';
          const tbody = table.querySelector('tbody');
          const rows = Array.from(tbody.querySelectorAll('tr'));
          rows.sort((a, b) => {
            const av = a.children[index]?.dataset.sortValue ?? '';
            const bv = b.children[index]?.dataset.sortValue ?? '';
            let cmp;
            if (type === 'number') {
              const an = Number(av);
              const bn = Number(bv);
              if (!Number.isFinite(an) && !Number.isFinite(bn)) cmp = 0;
              else if (!Number.isFinite(an)) cmp = 1;
              else if (!Number.isFinite(bn)) cmp = -1;
              else cmp = an - bn;
            } else {
              cmp = av.localeCompare(bv, undefined, { sensitivity: 'base' });
            }
            return nextDir === 'asc' ? cmp : -cmp;
          });
          rows.forEach((row) => tbody.appendChild(row));
          table.dataset.sortIndex = String(index);
          table.dataset.sortDir = nextDir;
        });
      });
    });
  }

  function layout(title, ytitle, xtitle) {
    return {
      title: { text: title, x: 0, xanchor: 'left', font: { size: 18 } },
      margin: { l: 56, r: 24, t: 52, b: 48 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: '#ffffff',
      hovermode: 'closest',
      xaxis: { title: xtitle || '', gridcolor: '#e5e7eb', zeroline: false },
      yaxis: { title: ytitle || '', gridcolor: '#e5e7eb', zeroline: false },
      legend: { orientation: 'h', y: -0.2 }
    };
  }

  const WORLD_RELATIVE_METRIC = 'world_relative_product_gini';

  function selectedFlowForMetric(flowId, metricId) {
    const flowSelect = byId(flowId);
    const metric = byId(metricId)?.value;
    if (metric === WORLD_RELATIVE_METRIC && flowSelect && flowSelect.value !== 'Exports') {
      flowSelect.value = 'Exports';
    }
    return flowSelect?.value || 'Exports';
  }

  function rowsFor(flow, metric, year) {
    return (DATA.exercise1?.panel || []).filter((row) => row.flow === flow && Number(row.year) === Number(year) && row[metric] !== null);
  }

  function mapScaleRange(flow, metric) {
    const values = (DATA.exercise1?.panel || [])
      .filter((row) => row.flow === flow && row[metric] !== null)
      .map((row) => Number(row[metric]))
      .filter((value) => Number.isFinite(value));
    if (!values.length) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (min === max) return null;
    return { min, max };
  }

  function currentMapYear() {
    return byId('map-year-slider')?.value || byId('map-year')?.value;
  }

  function setMapYear(value) {
    const slider = byId('map-year-slider');
    const select = byId('map-year');
    const label = byId('map-year-label');
    if (slider) slider.value = value;
    if (select) select.value = value;
    if (label) label.textContent = value;
  }

  function selectedCountries() {
    return Array.from(document.querySelectorAll('.country-check:checked')).map((el) => el.value);
  }

  function setDetail(row, metric) {
    const box = byId('line-detail');
    if (!box || !row) return;
    box.innerHTML = '<strong>' + row.country + '</strong> (' + row.iso3 + '), ' + row.year + ' ' + row.flow +
      '<br>' + (DATA.labels?.metrics?.[metric] || metric) + ': ' + fmt(row[metric]) +
      (row.world_relative_product_gini !== null && row.world_relative_product_gini !== undefined
        ? '<br>World-Relative Product Gini: ' + fmt(row.world_relative_product_gini) +
          ' | appendix weighted-share Gini: ' + fmt(row.world_weighted_share_gini)
        : '') +
      '<br>Product Gini (HS6 products): ' + fmt(row.product_gini) +
      ' | Partner Gini: ' + fmt(row.partner_gini) +
      ' | Cell Gini: ' + fmt(row.product_partner_cell_gini);
  }

  function renderMap() {
    const node = byId('world-map');
    if (!node) return;
    const metric = byId('map-metric').value;
    const flow = selectedFlowForMetric('map-flow', 'map-metric');
    const year = currentMapYear();
    const rows = rowsFor(flow, metric, year);
    const scaleRange = mapScaleRange(flow, metric);
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
      zauto: !scaleRange,
      zmin: scaleRange?.min,
      zmax: scaleRange?.max,
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
    const metric = byId('line-metric').value;
    const flow = selectedFlowForMetric('line-flow', 'line-metric');
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

  function energyPanel() {
    return DATA.exercise3?.energy_excluded_import_panel || [];
  }

  function energyRowsForYear(year) {
    return energyPanel().filter((row) => Number(row.year) === Number(year) && row.product_gini_ex_energy !== null);
  }

  function energyMapScaleRange() {
    const values = energyPanel()
      .map((row) => Number(row.product_gini_ex_energy))
      .filter((value) => Number.isFinite(value));
    if (!values.length) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (min === max) return null;
    return { min, max };
  }

  function currentEnergyMapYear() {
    return byId('energy-map-year-slider')?.value || byId('energy-map-year')?.value;
  }

  function setEnergyMapYear(value) {
    const slider = byId('energy-map-year-slider');
    const select = byId('energy-map-year');
    const label = byId('energy-map-year-label');
    if (slider) slider.value = value;
    if (select) select.value = value;
    if (label) label.textContent = value;
  }

  function selectedEnergyCountries() {
    return Array.from(document.querySelectorAll('.energy-country-check:checked')).map((el) => el.value);
  }

  function setEnergyDetail(row) {
    const box = byId('energy-line-detail');
    if (!box || !row) return;
    box.innerHTML = '<strong>' + row.country + '</strong> (' + row.iso3 + '), ' + row.year + ' Imports' +
      '<br>Product Gini excluding energy: ' + fmt(row.product_gini_ex_energy) +
      '<br>Baseline import Product Gini: ' + fmt(row.baseline_product_gini) +
      ' | Energy import share: ' + pct(row.energy_import_share);
  }

  function renderEnergyMap() {
    const node = byId('energy-world-map');
    if (!node) return;
    const year = currentEnergyMapYear();
    const rows = energyRowsForYear(year);
    const scaleRange = energyMapScaleRange();
    const trace = {
      type: 'choropleth',
      locations: rows.map((r) => r.iso3),
      z: rows.map((r) => r.product_gini_ex_energy),
      text: rows.map((r) => r.country),
      customdata: rows,
      colorscale: [
        [0, '#fef3c7'],
        [0.5, '#14b8a6'],
        [1, '#0f172a']
      ],
      zauto: !scaleRange,
      zmin: scaleRange?.min,
      zmax: scaleRange?.max,
      colorbar: { title: 'Product Gini ex energy' },
      marker: { line: { color: '#ffffff', width: 0.4 } },
      hovertemplate: '<b>%{text}</b><br>Ex-energy Gini: %{z:.3f}<extra></extra>'
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
    if (!node.dataset.energyClickBound) {
      node.on('plotly_click', (event) => {
        const row = event.points?.[0]?.customdata;
        if (!row) return;
        const check = document.querySelector('.energy-country-check[value="' + row.iso3 + '"]');
        if (check) check.checked = true;
        setEnergyDetail(row);
        renderEnergyLines();
      });
      node.dataset.energyClickBound = 'true';
    }
  }

  function renderEnergyCountryList() {
    const list = byId('energy-country-checkboxes');
    if (!list) return;
    const selectedDefaults = new Set(['IND', 'USA', 'CHN', 'DEU', 'JPN']);
    const countries = new Map();
    energyPanel().forEach((row) => {
      if (row.iso3 && row.country && !countries.has(row.iso3)) {
        countries.set(row.iso3, { iso3: row.iso3, country: row.country });
      }
    });
    list.innerHTML = '';
    Array.from(countries.values()).sort((a, b) => a.country.localeCompare(b.country)).forEach((country) => {
      const label = document.createElement('label');
      label.dataset.country = (country.country || '').toLowerCase();
      label.dataset.iso3 = country.iso3;
      label.innerHTML = '<input class="energy-country-check" type="checkbox" value="' + country.iso3 + '"' +
        (selectedDefaults.has(country.iso3) ? ' checked' : '') + '> ' + country.country;
      list.appendChild(label);
    });
    list.addEventListener('change', renderEnergyLines);
  }

  function filterEnergyCountryList() {
    const query = (byId('energy-country-search')?.value || '').toLowerCase();
    document.querySelectorAll('#energy-country-checkboxes label').forEach((label) => {
      const match = label.dataset.country.includes(query) || label.dataset.iso3.toLowerCase().includes(query);
      label.style.display = match ? 'flex' : 'none';
    });
  }

  function renderEnergyLines() {
    const node = byId('energy-country-lines');
    if (!node) return;
    const selected = selectedEnergyCountries();
    const rows = energyPanel().filter((row) => selected.includes(row.iso3));
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
        y: group.map((r) => r.product_gini_ex_energy),
        customdata: group,
        line: { color: COLORS[index % COLORS.length], width: 2 },
        marker: { size: 5 },
        hovertemplate: '<b>%{fullData.name}</b><br>%{x}: %{y:.3f}<extra></extra>'
      };
    });
    Plotly.react(node, traces, layout('Import Product Gini excluding energy over time', 'Gini'), config);
    if (!node.dataset.energyClickBound) {
      node.on('plotly_click', (event) => {
        const row = event.points?.[0]?.customdata;
        setEnergyDetail(row);
      });
      node.dataset.energyClickBound = 'true';
    }
  }

  function setupEnergyExcludedMapLines() {
    const panel = energyPanel();
    const yearSelect = byId('energy-map-year');
    const yearSlider = byId('energy-map-year-slider');
    if (!panel.length || !yearSelect || !yearSlider) {
      const detail = byId('energy-line-detail');
      if (detail) detail.textContent = 'No energy-excluded import panel data available.';
      return;
    }
    const years = Array.from(new Set(panel.map((row) => row.year))).sort((a, b) => a - b);
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);
    yearSelect.innerHTML = '';
    years.forEach((year) => {
      const option = document.createElement('option');
      option.value = year;
      option.textContent = year;
      if (year === maxYear) option.selected = true;
      yearSelect.appendChild(option);
    });
    yearSlider.min = minYear;
    yearSlider.max = maxYear;
    yearSlider.step = 1;
    yearSlider.value = maxYear;
    byId('energy-map-year-min').textContent = minYear;
    byId('energy-map-year-max').textContent = maxYear;
    setEnergyMapYear(maxYear);
    renderEnergyCountryList();
    byId('energy-map-year')?.addEventListener('change', (event) => {
      setEnergyMapYear(event.target.value);
      renderEnergyMap();
    });
    byId('energy-map-year-slider')?.addEventListener('input', (event) => {
      setEnergyMapYear(event.target.value);
      renderEnergyMap();
    });
    byId('energy-map-year-slider')?.addEventListener('change', (event) => {
      setEnergyMapYear(event.target.value);
      renderEnergyMap();
    });
    byId('energy-country-search')?.addEventListener('input', filterEnergyCountryList);
    byId('energy-select-all-countries')?.addEventListener('click', () => {
      document.querySelectorAll('.energy-country-check').forEach((el) => { el.checked = true; });
      renderEnergyLines();
    });
    byId('energy-clear-countries')?.addEventListener('click', () => {
      document.querySelectorAll('.energy-country-check').forEach((el) => { el.checked = false; });
      renderEnergyLines();
    });
    renderEnergyMap();
    renderEnergyLines();
  }

  function renderProfPLorenz() {
    const node = byId('prof-p-lorenz-chart');
    if (!node) return;
    const flow = byId('prof-p-lorenz-flow')?.value || 'Exports';
    const points = (DATA.profP?.lorenz_points || []).filter((row) => row.flow === flow);
    const summary = (DATA.profP?.lorenz_summary || []).filter((row) => row.flow === flow);
    const countryOrder = ['India', 'China', 'United States'];
    const traces = countryOrder.map((country, index) => {
      const countryPoints = points
        .filter((row) => row.country === country)
        .sort((a, b) => Number(a.point_index) - Number(b.point_index));
      const countrySummary = summary.find((row) => row.country === country) || {};
      return {
        type: 'scatter',
        mode: 'lines',
        name: country,
        x: countryPoints.map((row) => 100 * Number(row.cum_products_share)),
        y: countryPoints.map((row) => 100 * Number(row.cum_trade_value_share)),
        customdata: countryPoints.map(() => [
          countrySummary.modern_product_gini,
          countrySummary.modern_top_1pct_product_share,
          countrySummary.modern_top_5pct_product_share
        ]),
        line: { color: COLORS[index % COLORS.length], width: 3 },
        hovertemplate:
          '<b>' + country + '</b><br>' +
          'Products: %{x:.1f}%<br>' +
          'Trade value: %{y:.1f}%<br>' +
          'Gini: %{customdata[0]:.3f}<br>' +
          'Top 1% share: %{customdata[1]:.1%}<br>' +
          'Top 5% share: %{customdata[2]:.1%}<extra></extra>'
      };
    });
    traces.push({
      type: 'scatter',
      mode: 'lines',
      name: 'Equal distribution',
      x: [0, 100],
      y: [0, 100],
      line: { color: '#94a3b8', width: 1.5, dash: 'dash' },
      hoverinfo: 'skip'
    });
    const chartLayout = layout(flow + ' Lorenz curves, 2001', 'Cumulative trade value (%)', 'Cumulative active HS6 products (%)');
    chartLayout.xaxis.range = [0, 100];
    chartLayout.yaxis.range = [0, 100];
    Plotly.react(node, traces, chartLayout, { ...config, displayModeBar: false });

    const cards = byId('prof-p-lorenz-cards');
    if (cards) {
      cards.innerHTML = summary
        .sort((a, b) => countryOrder.indexOf(a.country) - countryOrder.indexOf(b.country))
        .map((row) => (
          '<article>' +
          '<h3>' + escapeHtml(row.country) + '</h3>' +
          '<p>Gini ' + fmt(row.modern_product_gini) +
          ' vs paper ' + fmt(row.paper_product_gini) +
          ' | top 1% ' + pct(row.modern_top_1pct_product_share) +
          ' | top 5% ' + pct(row.modern_top_5pct_product_share) +
          ' | products ' + Number(row.modern_active_products).toLocaleString() + '</p>' +
          '</article>'
        ))
        .join('');
    }
  }

  function setupProfP() {
    byId('prof-p-lorenz-flow')?.addEventListener('change', renderProfPLorenz);
    renderProfPLorenz();
  }

  function setupExtension() {
    const years = Array.from(new Set((DATA.exercise1?.panel || []).map((row) => row.year))).sort((a, b) => a - b);
    const yearSelect = byId('map-year');
    const yearSlider = byId('map-year-slider');
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);
    const requestedDefaultYear = Number(DATA.exercise1?.default_year) || maxYear;
    const defaultYear = years.includes(requestedDefaultYear) ? requestedDefaultYear : maxYear;
    const defaultMetric = DATA.exercise1?.default_metric || 'product_gini';
    years.forEach((year) => {
      const option = document.createElement('option');
      option.value = year;
      option.textContent = year;
      if (year === defaultYear) option.selected = true;
      yearSelect.appendChild(option);
    });
    if (yearSlider) {
      yearSlider.min = minYear;
      yearSlider.max = maxYear;
      yearSlider.step = 1;
      yearSlider.value = defaultYear;
      byId('map-year-min').textContent = minYear;
      byId('map-year-max').textContent = maxYear;
    }
    ['map-metric', 'line-metric'].forEach((id) => {
      const select = byId(id);
      if (select && Array.from(select.options).some((option) => option.value === defaultMetric)) {
        select.value = defaultMetric;
      }
    });
    setMapYear(defaultYear);
    renderCountryList();
    ['map-flow', 'map-metric'].forEach((id) => byId(id)?.addEventListener('change', renderMap));
    byId('map-year')?.addEventListener('change', (event) => {
      setMapYear(event.target.value);
      renderMap();
    });
    byId('map-year-slider')?.addEventListener('input', (event) => {
      setMapYear(event.target.value);
      renderMap();
    });
    byId('map-year-slider')?.addEventListener('change', (event) => {
      setMapYear(event.target.value);
      renderMap();
    });
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
    setupEnergyExcludedMapLines();
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
      hovertemplate: '%{x}<br>Median Product Gini (HS6 products): %{y:.3f}<extra></extra>'
    };
    Plotly.react(node, [trace], layout('Median import Product Gini after lumpy-product exclusions', 'Product Gini'), config);
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
    const chartLayout = layout('How far actual Product Ginis sit above random benchmarks', 'Actual minus benchmark Product Gini');
    chartLayout.barmode = 'group';
    Plotly.react(node, traces, chartLayout, config);
  }

  function setupImports() {
    renderImportBins();
    renderSupplierChart();
    renderWorldSupplierChart();
    renderIoChart();
    renderHs2LinkageCharts();
    byId('hs2-linkage-view')?.addEventListener('change', renderHs2LinkageCharts);
  }

  function renderImportBins() {
    const node = byId('import-bin-chart');
    if (!node) return;
    const rows = DATA.exercise3?.bin_summary || [];
    const traces = [
      { name: 'Product Gini (within bin)', y: rows.map((r) => r.product_gini), marker: { color: '#0f766e' } },
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
    Plotly.react(node, traces, layout('Dominant supplier to a particular country', 'Share'), config);
  }

  function renderWorldSupplierChart() {
    const node = byId('world-supplier-chart');
    if (!node) return;
    const rows = DATA.h24Supplier?.year_series || [];
    const traces = [
      ['median_top_supplier_share', 'Median top-supplier share', '#0f766e'],
      ['share_products_top_supplier_ge_75', 'Share of products with top supplier >=75%', '#b7791f'],
      ['import_value_share_top_supplier_ge_75', 'Import value share in >=75% products', '#2563eb']
    ].map(([key, name, color]) => ({
      type: 'scatter',
      mode: 'lines+markers',
      name,
      x: rows.map((r) => r.year),
      y: rows.map((r) => r[key]),
      line: { color, width: 2 },
      hovertemplate: name + '<br>%{x}: %{y:.3f}<extra></extra>'
    }));
    Plotly.react(node, traces, layout('Dominant supplier to all countries', 'Share'), config);
  }

  function renderIoChart() {
    const node = byId('io-chart');
    if (!node) return;
    const rows = DATA.exercise11?.year_series || [];
    const traces = [
      ['weighted_top_sector_input_product_gini', 'Top-sector input Product Gini', '#0f766e'],
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

  function hs2RowsForCurrentView() {
    const view = byId('hs2-linkage-view')?.value || 'decile';
    const linkage = DATA.exercise11?.hs2_linkage || {};
    return {
      view,
      rows: view === 'chapter' ? (linkage.chapters || []) : (linkage.deciles || [])
    };
  }

  function hs2MarkerSizes(rows) {
    return rows.map((row) => {
      const share = Math.max(0, Number(row.mean_import_share) || 0);
      return 8 + Math.sqrt(share) * 90;
    });
  }

  function renderHs2LinkageChart(nodeId, outcomeKey, title, ytitle, color) {
    const node = byId(nodeId);
    if (!node) return;
    const { view, rows } = hs2RowsForCurrentView();
    const xTitle = 'Mean summed HS6 LOO Gini contribution';
    let trace;
    if (view === 'chapter') {
      trace = {
        type: 'scatter',
        mode: 'markers',
        name: 'HS2 chapters',
        x: rows.map((r) => r.mean_loo_gini),
        y: rows.map((r) => r[outcomeKey]),
        text: rows.map((r) => r.display_label),
        customdata: rows.map((r) => [
          r.mean_import_share,
          r.mean_intermediate_import_share,
          r.mean_export_share,
          r.observations,
          r.mean_export_value
        ]),
        marker: {
          size: hs2MarkerSizes(rows),
          color: rows.map((r) => r.mean_intermediate_import_share),
          colorscale: 'Viridis',
          colorbar: { title: 'Intermediate<br>import share' },
          opacity: 0.82,
          line: { color: '#ffffff', width: 0.7 }
        },
        hovertemplate:
          '<b>%{text}</b><br>' +
          xTitle + ': %{x:.4f}<br>' +
          ytitle + ': %{y:.3f}<br>' +
          'Mean import share: %{customdata[0]:.2%}<br>' +
          'Intermediate import share: %{customdata[1]:.1%}<br>' +
          'Mean export share: %{customdata[2]:.2%}<br>' +
          'Mean export value: $%{customdata[4]:,.0f}<br>' +
          'Panel rows: %{customdata[3]}<extra></extra>'
      };
    } else {
      trace = {
        type: 'scatter',
        mode: 'lines+markers',
        name: 'Decile averages',
        x: rows.map((r) => r.mean_loo_gini),
        y: rows.map((r) => r[outcomeKey]),
        text: rows.map((r) => 'Decile ' + r.decile),
        customdata: rows.map((r) => [
          r.observations,
          r.chapter_count,
          r.min_loo_gini,
          r.max_loo_gini,
          r.top_chapters,
          r.mean_import_share,
          r.mean_intermediate_import_share,
          r.mean_export_value
        ]),
        line: { color, width: 2 },
        marker: { size: 8, color },
        hovertemplate:
          '<b>%{text}</b><br>' +
          xTitle + ': %{x:.4f}<br>' +
          ytitle + ': %{y:.3f}<br>' +
          'LOO range: %{customdata[2]:.4f} to %{customdata[3]:.4f}<br>' +
          'Rows: %{customdata[0]} | HS2 chapters: %{customdata[1]}<br>' +
          'Mean import share: %{customdata[5]:.2%}<br>' +
          'Intermediate import share: %{customdata[6]:.1%}<br>' +
          'Mean export value: $%{customdata[7]:,.0f}<br>' +
          'Largest import-share chapters:<br>%{customdata[4]}<extra></extra>'
      };
    }
    const chartLayout = layout(title, ytitle, xTitle);
    chartLayout.margin = { l: 64, r: view === 'chapter' ? 84 : 24, t: 52, b: 64 };
    chartLayout.showlegend = false;
    chartLayout.xaxis.zeroline = true;
    chartLayout.xaxis.zerolinecolor = '#94a3b8';
    Plotly.react(node, [trace], chartLayout, config);
  }

  function renderHs2LinkageCharts() {
    renderHs2LinkageChart(
      'hs2-probability-chart',
      'export_probability',
      'HS2 export probability',
      'Probability HS2 chapter is exported',
      '#2f5d62'
    );
    renderHs2LinkageChart(
      'hs2-value-chart',
      'mean_asinh_export_value',
      'HS2 export value',
      'Mean transformed HS2 export value',
      '#8c4f2b'
    );
  }

  document.addEventListener('DOMContentLoaded', () => {
    const page = document.body.dataset.page;
    setupSortableTables();
    if (page === 'extension') setupExtension();
    if (page === 'imports') setupImports();
    if (page === 'prof-p') setupProfP();
    window.addEventListener('resize', relayout);
  });
})();
