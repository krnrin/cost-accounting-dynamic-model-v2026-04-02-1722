(function (global) {
    'use strict';

    const $ = (id) => document.getElementById(id);
    const state = {
        currentStep: 1,
        projectInfo: {},
        bomData: null,
        harnesses: [],
        rates: {},
        volumes: [],
        ratios: {}
    };

    function init() {
        bindEvents();
        updateStepUI();
    }

    function bindEvents() {
        $('nextBtn').addEventListener('click', () => nextStep());
        $('prevBtn').addEventListener('click', () => prevStep());
        $('cancelBtn').addEventListener('click', () => {
            if (confirm('确定要取消并离开吗？所有输入将丢失。')) {
                window.location.href = 'dashboard.html';
            }
        });

        // Step 2: BOM Upload
        const dropZone = $('dropZone');
        const fileInput = $('bomFile');
        const selectFileBtn = $('selectFileBtn');

        selectFileBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            handleFile(e.dataTransfer.files[0]);
        });
    }

    function nextStep() {
        if (state.currentStep === 1) {
            if (!validateStep1()) return;
        } else if (state.currentStep === 2) {
            if (!state.harnesses || state.harnesses.length === 0) {
                alert('请先导入并确认 BOM 数据');
                return;
            }
        } else if (state.currentStep === 3) {
            if (!validateStep3()) return;
        } else if (state.currentStep === 4) {
            finishWizard();
            return;
        }

        state.currentStep++;
        updateStepUI();
        if (state.currentStep === 4) {
            prepareStep4();
        }
    }

    function prevStep() {
        if (state.currentStep > 1) {
            state.currentStep--;
            updateStepUI();
        }
    }

    function updateStepUI() {
        document.querySelectorAll('.step').forEach(el => {
            const step = parseInt(el.dataset.step);
            el.classList.toggle('active', step === state.currentStep);
            el.classList.toggle('completed', step < state.currentStep);
        });

        document.querySelectorAll('.wizard-pane').forEach(el => {
            el.classList.toggle('active', el.id === `pane-${state.currentStep}`);
        });

        $('prevBtn').disabled = state.currentStep === 1;
        $('nextBtn').textContent = state.currentStep === 4 ? '完成并进入看板' : '下一步';
    }

    function validateStep1() {
        const projectName = $('projectName').value.trim();
        const customer = $('customer').value.trim();
        const projectId = $('projectId').value.trim();

        if (!projectName || !customer || !projectId) {
            alert('项目名称、客户和代号不能为空');
            return false;
        }

        state.projectInfo = {
            projectName,
            customer,
            projectId,
            platform: $('platform').value.trim(),
            sopYear: parseInt($('sopYear').value),
            lifecycleYears: parseInt($('lifecycleYears').value)
        };
        return true;
    }

    function validateStep3() {
        const laborRate = parseFloat($('laborRate').value);
        const mfgRate = parseFloat($('mfgRate').value);
        const wasteRate = parseFloat($('wasteRate').value);
        const mgmtRate = parseFloat($('mgmtRate').value);
        const profitRate = parseFloat($('profitRate').value);
        const copperBase = parseFloat($('copperBasePrice').value);
        const aluminumBase = parseFloat($('aluminumBasePrice').value);

        if (isNaN(laborRate) || laborRate < 0) { alert('无效的人工费率'); return false; }
        if (isNaN(mfgRate) || mfgRate < 0) { alert('无效的制造费率'); return false; }
        if (isNaN(wasteRate) || wasteRate < 0 || wasteRate > 100) { alert('无效的废品率'); return false; }
        if (isNaN(mgmtRate) || mgmtRate < 0 || mgmtRate > 100) { alert('无效的管理费率'); return false; }
        if (isNaN(profitRate) || profitRate < -100 || profitRate > 100) { alert('无效的利润率'); return false; }
        if (isNaN(copperBase) || copperBase <= 0) { alert('无效的铜基价'); return false; }
        if (isNaN(aluminumBase) || aluminumBase <= 0) { alert('无效的铝基价'); return false; }

        state.rates = {
            laborRate,
            mfgRate,
            wasteRate: wasteRate / 100,
            mgmtRate: mgmtRate / 100,
            profitRate: profitRate / 100,
            copperBase,
            aluminumBase
        };
        return true;
    }

    function validateStep4() {
        const volInputs = document.querySelectorAll('.year-vol');
        for (const input of volInputs) {
            if (isNaN(parseInt(input.value)) || parseInt(input.value) < 0) {
                alert('请输入有效的年度产量');
                return false;
            }
        }
        const ratioInputs = document.querySelectorAll('.harness-ratio');
        for (const input of ratioInputs) {
            if (isNaN(parseFloat(input.value)) || parseFloat(input.value) < 0) {
                alert('请输入有效的装车比');
                return false;
            }
        }
        return true;
    }

    async function handleFile(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            // Build a snapshot format that G281BomParser expects
            const snapshot = {
                name: file.name,
                sheetOrder: workbook.SheetNames,
                sheets: {}
            };

            workbook.SheetNames.forEach(name => {
                const sheet = workbook.Sheets[name];
                const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
                const cellData = {};
                
                for (let r = 0; r <= range.e.r; r++) {
                    const row = {};
                    for (let c = 0; c <= range.e.c; c++) {
                        const cellAddress = XLSX.utils.encode_cell({r, c});
                        const cell = sheet[cellAddress];
                        if (cell) {
                            row[c] = { v: cell.v };
                        }
                    }
                    if (Object.keys(row).length > 0) {
                        cellData[r] = row;
                    }
                }

                snapshot.sheets[name] = {
                    name: name,
                    rowCount: range.e.r + 1,
                    cellData: cellData
                };
            });

            const parsed = global.G281BomParser.parseBomWorkbookSnapshot(snapshot, {
                projectCode: state.projectInfo.projectId,
                releaseLabel: 'Initial Import'
            });

            state.bomData = parsed;
            state.harnesses = parsed.headers.map(h => ({
                id: h.harnessNo,
                name: h.harnessName,
                family: h.harnessName.includes('直流') ? '直流母线' : '其他',
                ratio: 1.0
            }));

            renderHarnessList();
        };
        reader.readAsArrayBuffer(file);
    }

    function renderHarnessList() {
        const tbody = $('harnessList');
        tbody.innerHTML = '';
        state.harnesses.forEach(h => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${h.id}</td>
                <td>${h.name}</td>
                <td>${h.family}</td>
                <td>${(h.ratio * 100).toFixed(0)}%</td>
                <td><button class="mini-button danger" onclick="this.closest('tr').remove()">删除</button></td>
            `;
            tbody.appendChild(tr);
        });
        $('bomPreview').hidden = false;
    }

    function prepareStep4() {
        // Render Year Grid
        const yearGrid = $('yearVolumeGrid');
        yearGrid.innerHTML = '';
        const startYear = state.projectInfo.sopYear;
        const years = state.projectInfo.lifecycleYears;

        for (let i = 0; i < years; i++) {
            const year = startYear + i;
            const div = document.createElement('label');
            div.className = 'year-card';
            div.innerHTML = `
                <span>${year}</span>
                <input type="number" class="year-vol" data-year="${year}" value="100000" step="1000">
            `;
            yearGrid.appendChild(div);
        }

        // Render Harness Ratio Grid
        const ratioGrid = $('harnessRatioGrid');
        ratioGrid.innerHTML = '';
        state.harnesses.forEach(h => {
            const div = document.createElement('div');
            div.className = 'ratio-item';
            div.innerHTML = `
                <div class="name-wrap">
                    <span class="part-name">${h.name}</span>
                    <span class="part-no">${h.id}</span>
                </div>
                <input type="number" class="harness-ratio" data-id="${h.id}" value="1.0" step="0.01" min="0" max="1">
            `;
            ratioGrid.appendChild(div);
        });
    }

    async function finishWizard() {
        if (!validateStep4()) return;
        // rates are already collected in validateStep3 if we came from step 3

        // Collect Step 4 volumes & ratios
        state.volumes = Array.from(document.querySelectorAll('.year-vol')).map(input => ({
            year: parseInt(input.dataset.year),
            volume: parseInt(input.value)
        }));

        const ratioInputs = document.querySelectorAll('.harness-ratio');
        ratioInputs.forEach(input => {
            const h = state.harnesses.find(item => item.id === input.dataset.id);
            if (h) h.ratio = parseFloat(input.value);
        });

        // Build projectConfig (Compatible with g281.project.json)
        const projectConfig = {
            projectId: state.projectInfo.projectId,
            projectName: state.projectInfo.projectName,
            customer: state.projectInfo.customer,
            createdAt: new Date().toISOString(),
            baseline: {
                version: 1,
                lifecycle: {
                    startYear: state.projectInfo.sopYear,
                    years: state.projectInfo.lifecycleYears
                },
                vehicleConfigs: [
                    {
                        name: "基准配置",
                        ratio: 1.0,
                        harnesses: state.harnesses.map(h => h.id)
                    }
                ],
                annualVolumes: state.volumes
            },
            harnesses: state.harnesses.map(h => ({
                id: h.id,
                name: h.name,
                family: h.family,
                vehicleRatio: h.ratio,
                unit: "set"
            })),
            costRates: {
                customer: {
                    laborRate: state.rates.laborRate,
                    mfgRate: state.rates.mfgRate,
                    wasteRate: state.rates.wasteRate,
                    mgmtRate: state.rates.mgmtRate,
                    mgmtBase: "material+labor+mfg",
                    profitRate: state.rates.profitRate,
                    profitBase: "material+waste+labor+mfg+mgmt"
                }
            },
            metalContract: {
                baseCopperPrice: state.rates.copperBase,
                baseAluminumPrice: state.rates.aluminumBase,
                thresholdPercent: 0,
                escalationRatio: 1.0,
                period: "quarterly"
            },
            dimensions: {
                currency: "CNY",
                currencySymbol: "¥",
                lengthUnit: "mm",
                weightUnit: "g",
                volumeUnit: "套",
                priceDecimalPlaces: 4,
                ratioDecimalPlaces: 2
            },
            bom: {
                dataStartRow: 5,
                maxColumns: 17
            }
        };

        // Save to DB
        const db = global.G281BomDb;
        await db.init();

        // 1. Save Project Info as a Scenario (to be picked up by dashboard)
        const scenario = {
            scenarioId: `scenario-${state.projectInfo.projectId}-baseline`,
            name: "基准场景",
            projectCode: state.projectInfo.projectId,
            state: {
                bom: 'initial',
                metal: 'base',
                labor: 'base',
                equipment: 'base',
                packaging: 'base',
                sales: 'base',
                mix: 'base'
            },
            draft: projectConfig
        };
        await db.putRecord('scenarios', scenario);

        // 2. Save BOM Release
        if (state.bomData) {
            const release = state.bomData;
            release.releaseId = 'initial-bom-' + state.projectInfo.projectId;
            release.projectCode = state.projectInfo.projectId;
            
            await db.putRecord('bomReleaseBatches', {
                releaseId: release.releaseId,
                projectCode: release.projectCode,
                releaseLabel: '初始导入',
                createdAt: new Date().toISOString(),
                harnessCount: release.headers.length,
                itemCount: release.items.length
            });
            await db.putMany('bomHeaders', release.headers.map(h => ({...h, releaseId: release.releaseId})));
            await db.putMany('bomItems', release.items.map(i => ({...i, releaseId: release.releaseId})));
        }

        // Store active project in localStorage so dashboard knows what to load
        localStorage.setItem('G281_ACTIVE_PROJECT', state.projectInfo.projectId);
        localStorage.setItem('G281_PROJECT_CONFIG_' + state.projectInfo.projectId, JSON.stringify(projectConfig));
        
        // Harness Seed Data for dashboard
        const harnessSeedData = state.harnesses.map(h => ({
            harnessId: h.id,
            name: h.name,
            family: h.family,
            vehicleRatio: h.ratio,
            copperWeight: 0,
            aluminumWeight: 0,
            materialCost: 0,
            processHours: 0
        }));
        localStorage.setItem('G281_SEED_DATA_' + state.projectInfo.projectId, JSON.stringify(harnessSeedData));

        // Redirect
        alert('项目创建成功！正在进入看板...');
        window.location.href = 'dashboard.html?projectId=' + state.projectInfo.projectId;
    }

    init();
})(window);
