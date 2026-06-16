
(function () {
  const DATA = window.TRADE_GINI_DATA || {};
  const COLORS = ['#0f766e', '#2563eb', '#b7791f', '#dc2626', '#7c3aed', '#0891b2', '#4d7c0f', '#be123c', '#4338ca', '#a16207', '#0f172a', '#ea580c'];
  const config = { responsive: true, displayModeBar: true, displaylogo: false };
  const RANK_BUCKETS = [
    { key: 'top5_share', label: 'Top 5', color: '#1f77b4' },
    { key: 'rank6_50_share', label: 'Ranks 6-50', color: '#ffbf69' },
    { key: 'rank51_200_share', label: 'Ranks 51-200', color: '#8ecae6' },
    { key: 'rank201_plus_share', label: 'Rank 201+ tail', color: '#d1d5db' }
  ];
  const SNAPSHOT_ORDER = { start: 0, mid: 1, end: 2 };
  const SNAPSHOT_REVERSE_ORDER = { end: 0, mid: 1, start: 2 };

  function fmt(value, digits = 3) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return 'n/a';
    return Number(value).toFixed(digits);
  }

  function pct(value, digits = 1) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return 'n/a';
    return (100 * Number(value)).toFixed(digits) + '%';
  }

  function usdShort(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 'n/a';
    const abs = Math.abs(number);
    if (abs >= 1e12) return '$' + (number / 1e12).toFixed(2) + 'T';
    if (abs >= 1e9) return '$' + (number / 1e9).toFixed(1) + 'B';
    if (abs >= 1e6) return '$' + (number / 1e6).toFixed(1) + 'M';
    return '$' + number.toLocaleString(undefined, { maximumFractionDigits: 0 });
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

  const EXPORT_WORLD_RELATIVE_METRIC = 'world_relative_product_gini';
  const IMPORT_WORLD_RELATIVE_METRIC = 'world_relative_import_product_gini';

  function selectedFlowForMetric(flowId, metricId) {
    const flowSelect = byId(flowId);
    const metric = byId(metricId)?.value;
    if (metric === EXPORT_WORLD_RELATIVE_METRIC && flowSelect && flowSelect.value !== 'Exports') {
      flowSelect.value = 'Exports';
    }
    if (metric === IMPORT_WORLD_RELATIVE_METRIC && flowSelect && flowSelect.value !== 'Imports') {
      flowSelect.value = 'Imports';
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

  function energyDriverRows() {
    return DATA.exercise3?.energy_driver_classification || [];
  }

  function energyDriverGroupOrder(group) {
    const order = [
      'top-5 superstar concentration',
      'upper-tier concentration (ranks 6-50)',
      'broad upper-tail concentration (ranks 51-200)',
      'tail compression (rank 201+)',
      'stable / small Gini change',
      'top-5 deconcentration',
      'upper-tier deconcentration (ranks 6-50)'
    ];
    const index = order.indexOf(group);
    return index === -1 ? 999 : index;
  }

  function energyDriverDelta(row) {
    const panelDelta = Number(row.delta_panel_ex_energy_gini);
    if (Number.isFinite(panelDelta)) return panelDelta;
    const calculatedDelta = Number(row.delta_calculated_ex_energy_gini);
    return Number.isFinite(calculatedDelta) ? calculatedDelta : null;
  }

  function signedFmt(value, digits = 3) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return 'n/a';
    const number = Number(value);
    return (number > 0 ? '+' : '') + number.toFixed(digits);
  }

  function focusEnergyCountry(iso3) {
    const check = Array.from(document.querySelectorAll('.energy-country-check')).find((el) => el.value === iso3);
    if (check) check.checked = true;
    renderEnergyLines();
    const countryRows = energyPanel()
      .filter((row) => row.iso3 === iso3)
      .sort((a, b) => Number(a.year) - Number(b.year));
    if (countryRows.length) setEnergyDetail(countryRows[countryRows.length - 1]);
  }

  function renderEnergyDriverCountryList() {
    const list = byId('energy-driver-country-list');
    const select = byId('energy-driver-group-select');
    if (!list || !select) return;
    const selectedGroup = select.value || '__all__';
    const rows = energyDriverRows()
      .filter((row) => selectedGroup === '__all__' || row.main_driver_group === selectedGroup)
      .sort((a, b) => {
        const groupCmp = energyDriverGroupOrder(a.main_driver_group) - energyDriverGroupOrder(b.main_driver_group);
        if (groupCmp !== 0) return groupCmp;
        const deltaCmp = Math.abs(energyDriverDelta(b) || 0) - Math.abs(energyDriverDelta(a) || 0);
        return deltaCmp || String(a.country || '').localeCompare(String(b.country || ''));
      });
    if (!rows.length) {
      list.textContent = 'No countries available for this driver group.';
      return;
    }
    const pieces = [];
    let currentGroup = null;
    rows.forEach((row) => {
      if (selectedGroup === '__all__' && row.main_driver_group !== currentGroup) {
        currentGroup = row.main_driver_group;
        pieces.push('<h4 class="driver-country-group">' + escapeHtml(currentGroup) + '</h4>');
      }
      const delta = energyDriverDelta(row);
      const direction = row.gini_change_direction ? ' ' + row.gini_change_direction : '';
      pieces.push(
        '<div class="driver-country-item">' +
          '<button type="button" class="driver-country-button" data-iso3="' + escapeHtml(row.iso3) + '">' +
            escapeHtml(row.country) +
          '</button>' +
          '<span class="driver-country-meta">Δ ' + signedFmt(delta) + direction + '</span>' +
        '</div>'
      );
    });
    list.innerHTML = pieces.join('');
  }

  function renderEnergyDriverDropdown() {
    const dropdown = byId('energy-driver-dropdown');
    const select = byId('energy-driver-group-select');
    const list = byId('energy-driver-country-list');
    if (!dropdown || !select || !list) return;
    const rows = energyDriverRows();
    if (!rows.length) {
      dropdown.open = false;
      select.innerHTML = '';
      list.textContent = 'No rank-bucket driver classification is available for this sample.';
      return;
    }
    const counts = new Map();
    rows.forEach((row) => {
      const group = row.main_driver_group || 'Unclassified';
      counts.set(group, (counts.get(group) || 0) + 1);
    });
    const groups = Array.from(counts.keys()).sort((a, b) => {
      const orderCmp = energyDriverGroupOrder(a) - energyDriverGroupOrder(b);
      return orderCmp || a.localeCompare(b);
    });
    select.innerHTML =
      '<option value="__all__">All driver groups (' + rows.length + ' countries)</option>' +
      groups.map((group) => (
        '<option value="' + escapeHtml(group) + '">' + escapeHtml(group) + ' (' + counts.get(group) + ')</option>'
      )).join('');
    if (!select.dataset.driverBound) {
      select.addEventListener('change', renderEnergyDriverCountryList);
      select.dataset.driverBound = 'true';
    }
    if (!list.dataset.driverBound) {
      list.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-iso3]');
        if (!button) return;
        focusEnergyCountry(button.dataset.iso3);
      });
      list.dataset.driverBound = 'true';
    }
    renderEnergyDriverCountryList();
  }

  function nonenergyRankRows() {
    return DATA.exercise3?.nonenergy_rank_decomposition || [];
  }

  function nonenergyTopProductRows() {
    return DATA.exercise3?.nonenergy_top_products || [];
  }

  function rankBucketDriverLookup() {
    const lookup = new Map();
    energyDriverRows().forEach((row) => {
      if (row.iso3) lookup.set(row.iso3, row);
    });
    return lookup;
  }

  function rankBucketCountrySummaries() {
    const drivers = rankBucketDriverLookup();
    const countries = new Map();
    nonenergyRankRows().forEach((row) => {
      if (!row.iso3 || !row.country) return;
      if (!countries.has(row.iso3)) {
        const driver = drivers.get(row.iso3) || {};
        countries.set(row.iso3, {
          iso3: row.iso3,
          country: row.country,
          driverGroup: driver.main_driver_group || 'Unclassified',
          delta: energyDriverDelta(driver),
          endTop5: null,
          endTail: null,
          rows: []
        });
      }
      const country = countries.get(row.iso3);
      country.rows.push(row);
      if (row.snapshot === 'end') {
        country.endTop5 = Number(row.top5_share);
        country.endTail = Number(row.rank201_plus_share);
      }
    });
    return Array.from(countries.values());
  }

  function compareRankBucketCountries(sortMode) {
    return (a, b) => {
      if (sortMode === 'country') return a.country.localeCompare(b.country);
      if (sortMode === 'driver_group') {
        const groupCmp = energyDriverGroupOrder(a.driverGroup) - energyDriverGroupOrder(b.driverGroup);
        if (groupCmp !== 0) return groupCmp;
        const deltaCmp = Math.abs(b.delta || 0) - Math.abs(a.delta || 0);
        return deltaCmp || a.country.localeCompare(b.country);
      }
      if (sortMode === 'end_tail_desc') {
        const tailCmp = (Number(b.endTail) || -1) - (Number(a.endTail) || -1);
        return tailCmp || a.country.localeCompare(b.country);
      }
      const top5Cmp = (Number(b.endTop5) || -1) - (Number(a.endTop5) || -1);
      return top5Cmp || a.country.localeCompare(b.country);
    };
  }

  function selectedRankBucketCountries() {
    const group = byId('rank-bucket-group')?.value || '__all__';
    const query = (byId('rank-bucket-search')?.value || '').trim().toLowerCase();
    const sortMode = byId('rank-bucket-sort')?.value || 'end_top5_desc';
    return rankBucketCountrySummaries()
      .filter((country) => group === '__all__' || country.driverGroup === group)
      .filter((country) => {
        if (!query) return true;
        return country.country.toLowerCase().includes(query) || country.iso3.toLowerCase().includes(query);
      })
      .sort(compareRankBucketCountries(sortMode));
  }

  function rankBucketSnapshotSort(reverse) {
    const order = reverse ? SNAPSHOT_REVERSE_ORDER : SNAPSHOT_ORDER;
    return (a, b) => {
      const orderCmp = (order[a.snapshot] ?? 99) - (order[b.snapshot] ?? 99);
      return orderCmp || Number(a.year) - Number(b.year);
    };
  }

  function rankBucketLabel(row, includeCountry) {
    const snapshot = String(row.snapshot || '').toLowerCase();
    const text = snapshot ? snapshot.charAt(0).toUpperCase() + snapshot.slice(1) : 'Snapshot';
    const prefix = includeCountry ? row.country + '  ' : '';
    return prefix + text + ' ' + row.year;
  }

  function rankBucketTraces(rows, includeCountry) {
    return RANK_BUCKETS.map((bucket) => ({
      type: 'bar',
      orientation: 'h',
      name: bucket.label,
      x: rows.map((row) => Number(row[bucket.key])),
      y: rows.map((row) => rankBucketLabel(row, includeCountry)),
      customdata: rows.map((row) => [
        row.active_nonenergy_products,
        row.total_nonenergy_imports,
        row.top10_share,
        row.iso3,
        row.snapshot,
        row.year
      ]),
      marker: { color: bucket.color },
      hovertemplate:
        '<b>%{y}</b><br>' +
        bucket.label + ': %{x:.1%}<br>' +
        'Top 10: %{customdata[2]:.1%}<br>' +
        'Active non-energy HS6: %{customdata[0]:,.0f}<br>' +
        'Non-energy imports: $%{customdata[1]:,.0f}<extra></extra>'
    }));
  }

  function renderRankBucketOverview() {
    const node = byId('rank-bucket-overview');
    if (!node) return;
    const countries = selectedRankBucketCountries();
    const rows = countries.flatMap((country) =>
      country.rows.slice().sort(rankBucketSnapshotSort(true))
    );
    if (!rows.length) {
      Plotly.purge(node);
      node.textContent = 'No countries match the current rank-bucket filters.';
      return;
    }
    const chartLayout = layout(
      'Non-energy import basket decomposition: refined rank buckets',
      '',
      'Share of non-energy imports'
    );
    chartLayout.height = Math.max(640, rows.length * 24 + 118);
    chartLayout.barmode = 'stack';
    chartLayout.margin = { l: 196, r: 24, t: 54, b: 70 };
    chartLayout.xaxis = {
      title: 'Share of non-energy imports',
      range: [0, 1],
      tickformat: '.0%',
      gridcolor: '#e5e7eb',
      zeroline: false
    };
    chartLayout.yaxis = {
      automargin: true,
      autorange: 'reversed',
      tickfont: { size: 10 },
      gridcolor: 'rgba(0,0,0,0)',
      zeroline: false
    };
    chartLayout.legend = { orientation: 'h', traceorder: 'normal', x: 0.5, xanchor: 'center', y: -0.08 };
    Plotly.react(node, rankBucketTraces(rows, true), chartLayout, { ...config, displayModeBar: false });
    if (!node.dataset.rankClickBound) {
      node.on('plotly_click', (event) => {
        const iso3 = event.points?.[0]?.customdata?.[3];
        const snapshot = event.points?.[0]?.customdata?.[4];
        const year = event.points?.[0]?.customdata?.[5];
        if (!iso3) return;
        const select = byId('rank-bucket-country');
        if (select) select.value = iso3;
        renderRankBucketCountryFocus(iso3, snapshot, year);
      });
      node.dataset.rankClickBound = 'true';
    }
  }

  function rankBucketCountryRows(iso3) {
    return nonenergyRankRows()
      .filter((row) => row.iso3 === iso3)
      .sort(rankBucketSnapshotSort(false));
  }

  function rankBucketTotalImports(row) {
    const match = (DATA.exercise3?.energy_excluded_import_panel || [])
      .find((item) => item.iso3 === row.iso3 && Number(item.year) === Number(row.year));
    return match ? Number(match.total_imports) : NaN;
  }

  function rankBucketTopProducts(row, limit = 5) {
    return nonenergyTopProductRows()
      .filter((item) =>
        item.iso3 === row.iso3 &&
        item.snapshot === row.snapshot &&
        Number(item.year) === Number(row.year)
      )
      .sort((a, b) => Number(a.rank) - Number(b.rank))
      .slice(0, limit);
  }

  function rankBucketDefaultDetailRow(rows) {
    return rows.find((row) => row.snapshot === 'end') || rows[rows.length - 1];
  }

  function renderRankBucketSnapshotDetail(row) {
    const detail = byId('rank-bucket-detail');
    if (!detail || !row) return;
    const products = rankBucketTopProducts(row, 5);
    const productHtml = products.length
      ? '<ul class="rank-bucket-products">' + products.map((product) => (
          '<li class="rank-bucket-product">' +
            '<span class="rank-bucket-product-name">' + escapeHtml(product.product_label || 'Unlabeled product') + '</span>' +
            '<span class="rank-bucket-product-code">HS ' + escapeHtml(product.cmd_code) + '</span>' +
            '<span class="rank-bucket-product-value">' +
              usdShort(product.trade_value) + ' · ' + pct(product.share_nonenergy_imports) + ' of non-energy imports' +
            '</span>' +
          '</li>'
        )).join('') + '</ul>'
      : '<p>No top-product rows are available for this snapshot.</p>';
    detail.innerHTML =
      '<div class="rank-bucket-detail-title">' + escapeHtml(row.country) + ' (' + escapeHtml(row.iso3) + ')</div>' +
      '<div>' + escapeHtml(rankBucketLabel(row, false)) + '</div>' +
      '<div class="rank-bucket-metrics">' +
        '<div class="rank-bucket-metric"><span>Non-energy imports</span><strong>' +
          usdShort(row.total_nonenergy_imports) +
        '</strong></div>' +
        '<div class="rank-bucket-metric"><span>Total imports</span><strong>' +
          usdShort(rankBucketTotalImports(row)) +
        '</strong></div>' +
      '</div>' +
      '<strong>Top non-energy products</strong>' +
      productHtml;
  }

  function renderRankBucketCountryFocus(iso3, detailSnapshot, detailYear) {
    const node = byId('rank-bucket-country-chart');
    const detail = byId('rank-bucket-detail');
    const title = byId('rank-bucket-focus-title');
    if (!node) return;
    const selectedIso = iso3 || byId('rank-bucket-country')?.value;
    const rows = rankBucketCountryRows(selectedIso);
    if (!rows.length) {
      Plotly.purge(node);
      if (detail) detail.textContent = 'No rank-bucket rows available for the selected country.';
      if (title) title.textContent = 'Country Focus';
      return;
    }
    const country = rows[0].country;
    if (title) title.textContent = 'Country Focus: ' + country;
    const chartLayout = layout('Rank-bucket shares', '', 'Share of non-energy imports');
    chartLayout.height = 330;
    chartLayout.barmode = 'stack';
    chartLayout.margin = { l: 92, r: 16, t: 52, b: 52 };
    chartLayout.xaxis = {
      title: 'Share of non-energy imports',
      range: [0, 1],
      tickformat: '.0%',
      gridcolor: '#e5e7eb',
      zeroline: false
    };
    chartLayout.yaxis = {
      automargin: true,
      autorange: 'reversed',
      gridcolor: 'rgba(0,0,0,0)',
      zeroline: false
    };
    chartLayout.legend = { orientation: 'h', traceorder: 'normal', x: 0.5, xanchor: 'center', y: -0.2 };
    Plotly.react(node, rankBucketTraces(rows, false), chartLayout, { ...config, displayModeBar: false });
    if (!node.dataset.rankFocusClickBound) {
      node.on('plotly_click', (event) => {
        const iso3Clicked = event.points?.[0]?.customdata?.[3];
        const snapshot = event.points?.[0]?.customdata?.[4];
        const year = event.points?.[0]?.customdata?.[5];
        const clickedRows = rankBucketCountryRows(iso3Clicked);
        const clickedRow = clickedRows.find((row) =>
          row.snapshot === snapshot && Number(row.year) === Number(year)
        );
        renderRankBucketSnapshotDetail(clickedRow || rankBucketDefaultDetailRow(clickedRows));
      });
      node.dataset.rankFocusClickBound = 'true';
    }
    const selectedDetailRow = rows.find((row) =>
      row.snapshot === detailSnapshot && Number(row.year) === Number(detailYear)
    );
    renderRankBucketSnapshotDetail(selectedDetailRow || rankBucketDefaultDetailRow(rows));
  }

  function setupRankBucketDecomposition() {
    const rows = nonenergyRankRows();
    const overview = byId('rank-bucket-overview');
    const countrySelect = byId('rank-bucket-country');
    const groupSelect = byId('rank-bucket-group');
    if (!overview || !countrySelect || !groupSelect) return;
    if (!rows.length) {
      overview.textContent = 'No non-energy rank-bucket decomposition data available.';
      return;
    }
    const countries = rankBucketCountrySummaries().sort((a, b) => a.country.localeCompare(b.country));
    countrySelect.innerHTML = countries.map((country) => (
      '<option value="' + escapeHtml(country.iso3) + '">' + escapeHtml(country.country) + '</option>'
    )).join('');
    const groupCounts = new Map();
    countries.forEach((country) => {
      groupCounts.set(country.driverGroup, (groupCounts.get(country.driverGroup) || 0) + 1);
    });
    const groups = Array.from(groupCounts.keys()).sort((a, b) => {
      const orderCmp = energyDriverGroupOrder(a) - energyDriverGroupOrder(b);
      return orderCmp || a.localeCompare(b);
    });
    groupSelect.innerHTML =
      '<option value="__all__">All countries (' + countries.length + ')</option>' +
      groups.map((group) => (
        '<option value="' + escapeHtml(group) + '">' + escapeHtml(group) + ' (' + groupCounts.get(group) + ')</option>'
      )).join('');
    const defaultCountry =
      countries.find((country) => country.iso3 === 'HKG') ||
      countries.slice().sort(compareRankBucketCountries('end_top5_desc'))[0];
    if (defaultCountry) countrySelect.value = defaultCountry.iso3;
    ['rank-bucket-group', 'rank-bucket-sort'].forEach((id) => {
      byId(id)?.addEventListener('change', renderRankBucketOverview);
    });
    byId('rank-bucket-search')?.addEventListener('input', renderRankBucketOverview);
    countrySelect.addEventListener('change', (event) => renderRankBucketCountryFocus(event.target.value));
    renderRankBucketOverview();
    renderRankBucketCountryFocus(countrySelect.value);
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
    renderEnergyDriverDropdown();
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
    setupRankBucketDecomposition();
    renderExclusionChart();
    renderBenchmarkChart();
  }

  function renderExclusionChart() {
    const node = byId('exclusion-chart');
    if (!node) return;
    const rows = (DATA.exercise6?.distribution || []).filter((row) => Number.isFinite(Number(row.product_gini)));
    if (!rows.length) return;
    const variantOrder = (DATA.exercise6?.median_by_variant || []).map((row) => row.variant);
    const grouped = new Map();
    rows.forEach((row) => {
      if (!grouped.has(row.variant)) grouped.set(row.variant, []);
      grouped.get(row.variant).push(row);
    });
    const variants = [
      ...variantOrder.filter((variant) => grouped.has(variant)),
      ...Array.from(grouped.keys()).filter((variant) => !variantOrder.includes(variant))
    ];
    const values = rows.map((row) => Number(row.product_gini));
    const rangeMin = Math.max(0, Math.floor((Math.min(...values) - 0.02) / 0.02) * 0.02);
    const rangeMax = Math.min(1, Math.ceil((Math.max(...values) + 0.02) / 0.02) * 0.02);
    const traces = variants.map((variant, index) => {
      const group = grouped.get(variant) || [];
      const label = group[0]?.label || variant;
      return {
        type: 'histogram',
        name: label,
        x: group.map((row) => Number(row.product_gini)),
        histnorm: 'probability',
        xbins: { start: rangeMin, end: rangeMax, size: 0.015 },
        marker: { color: COLORS[index % COLORS.length], line: { color: '#ffffff', width: 0.5 } },
        opacity: 0.48,
        hovertemplate: label + '<br>Product Gini bin: %{x:.3f}<br>Country-year share: %{y:.1%}<extra></extra>'
      };
    });
    const chartLayout = layout(
      'Import Product Gini distributions after lumpy-product exclusions',
      'Share of country-years',
      'Product Gini'
    );
    chartLayout.barmode = 'overlay';
    chartLayout.xaxis.range = [rangeMin, rangeMax];
    chartLayout.xaxis.tickformat = '.2f';
    chartLayout.yaxis.tickformat = '.0%';
    chartLayout.legend = { orientation: 'h', y: -0.28 };
    Plotly.react(node, traces, chartLayout, config);
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
