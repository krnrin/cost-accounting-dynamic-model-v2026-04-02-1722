window.G281_RUNTIME = {
  master: {
  "meta": {
    "modelName": "G281 高压线束动态利润模型",
    "sourceWorkbook": "G281高压财务可行性分析-0107- 定点价格(2).xlsx",
    "generatedAt": "2026-03-24T00:00:00+08:00",
    "layer": "JSON 数据层"
  },
  "name": "G281 基准生命周期场景",
  "sheetCount": 18,
  "faultCount": 7,
  "priceTypeCount": 9,
  "years": [
    2026,
    2027,
    2028,
    2029,
    2030,
    2031
  ],
  "volumes": [
    85000,
    135000,
    125000,
    114000,
    94000,
    47000
  ],
  "asp": [
    484.196845551355,
    479.251857437304,
    479.251857437304,
    479.251857437304,
    479.251857437304,
    479.251857437304
  ],
  "baseRevenuePerSet": 479.952397420128,
  "baseCostPerSet": 448.986992530091,
  "baseMaterial": 345.34157696939,
  "baseDirectHours": 1.13,
  "baseDirectRate": 35,
  "baseMfgHours": 0.47,
  "baseMfgRate": 47,
  "baseLaborPerSet": 39.4184765001779,
  "baseMfgPerSet": 22.2060244225358,
  "baseEquipmentPerSet": 27.1878637938209,
  "basePackagingPerSet": 12.6443008441667,
  "baseRndPerSet": 2.18875,
  "capital": {
    "equipment": 16312718.2762926,
    "tooling": 1796000,
    "fixtures": 1317800,
    "rnd": 641791
  },
  "bomDefaults": {
    "wireDrawing": 820,
    "wireEat": 35,
    "wireHidden": 18,
    "tapeDiameter": 8.5,
    "tapeWidth": 19,
    "tapeOverlap": 35
  },
  "copperPrice": 69300,
  "aluminumPrice": 18500,
  "priceMixIndexes": [
    0.9,
    0.97,
    1,
    1.15
  ],
  "costMixIndexes": [
    0.92,
    0.98,
    1,
    1.08
  ],
  "baselineMix": [
    10,
    40,
    35,
    15
  ],
  "configNames": [
    "CM010 · 探索版",
    "CM015 · 远航版",
    "CM020 · 启航版",
    "CM030 · 星舰版"
  ],
  "priceTypeCounts": [
    {
      "name": "系统价",
      "count": 126
    },
    {
      "name": "分摊价",
      "count": 48
    },
    {
      "name": "散件",
      "count": 44
    },
    {
      "name": "询价",
      "count": 23
    },
    {
      "name": "批量价",
      "count": 23
    },
    {
      "name": "总成参考价",
      "count": 12
    },
    {
      "name": "总成报价",
      "count": 1
    },
    {
      "name": "参考2310537-1散件价",
      "count": 1
    },
    {
      "name": "参考价",
      "count": 1
    }
  ],
  "connectorPortfolio": {
    "baseCostPerSet": 82.8819784726536,
    "items": [
      {
        "id": "battery_end_hv",
        "code": "CON-BAT-HV",
        "name": "接电池端高压连接器",
        "supplier": "安费诺",
        "share": 0.16,
        "quantity": 1,
        "note": "主回路高压接口，优先跟随已谈妥价格执行。"
      },
      {
        "id": "edrive_end_hv",
        "code": "CON-EDRIVE-HV",
        "name": "接电驱端高压连接器",
        "supplier": "安费诺",
        "share": 0.14,
        "quantity": 1,
        "note": "与电驱总成对接，单价波动会直接影响主材。"
      },
      {
        "id": "accm_end",
        "code": "CON-ACCM",
        "name": "接 ACCM 端连接器",
        "supplier": "TE",
        "share": 0.07,
        "quantity": 1,
        "note": "低压信号端，常见先走协议价。"
      },
      {
        "id": "ptc_end",
        "code": "CON-PTC",
        "name": "接 PTC 端连接器",
        "supplier": "TE",
        "share": 0.05,
        "quantity": 1,
        "note": "加热支路端口，采购量相对稳定。"
      },
      {
        "id": "charge_socket_main",
        "code": "CON-CHARGE-SOCKET",
        "name": "组合式充电插座总成",
        "supplier": "TE",
        "share": 0.18,
        "quantity": 1,
        "note": "充电插座总成，未谈妥时通常按样品价执行。"
      },
      {
        "id": "dc_charge_lv",
        "code": "CON-DC-LV",
        "name": "快充端低压连接器",
        "supplier": "TE",
        "share": 0.09,
        "quantity": 1,
        "note": "快充端低压插件，可单独切换采购档位。"
      },
      {
        "id": "ac_charge_lv",
        "code": "CON-AC-LV",
        "name": "慢充端低压连接器",
        "supplier": "安费诺",
        "share": 0.08,
        "quantity": 1,
        "note": "慢充端低压插件，常与 ODP 端分开谈价。"
      },
      {
        "id": "electronic_lock",
        "code": "CON-ELOCK",
        "name": "电子锁连接器",
        "supplier": "TE",
        "share": 0.05,
        "quantity": 1,
        "note": "电子锁低压连接器，量产价通常晚于主连接器。"
      },
      {
        "id": "low_voltage_inline",
        "code": "CON-INLINE-LV",
        "name": "低压 inline 连接器",
        "supplier": "住友",
        "share": 0.08,
        "quantity": 2,
        "note": "线束中段低压连接器，可保持跟随默认档位。"
      },
      {
        "id": "branch_splitter",
        "code": "CON-BRANCH",
        "name": "分线器连接器",
        "supplier": "住友",
        "share": 0.04,
        "quantity": 1,
        "note": "分支回路件，常见按样品价小批采购。"
      },
      {
        "id": "misc_terminal_set",
        "code": "CON-MISC",
        "name": "其他连接器与端子组合",
        "supplier": "多供应商",
        "share": 0.06,
        "quantity": 1,
        "note": "零散连接器和端子归并，便于先做混合试算。"
      }
    ]
  },
  "versions": {
    "bom": {
      "freeze": {
        "label": "冻结版",
        "factor": 1,
        "note": "按当前基准BOM执行，适合锁定定点价。"
      },
      "light": {
        "label": "轻量化版",
        "factor": 0.97,
        "note": "优化线长、支架与小辅料，材料成本下降。"
      },
      "regress": {
        "label": "回退版",
        "factor": 1.04,
        "note": "设计回退或供应链变更带来材料上涨。"
      }
    },
    "connector": {
      "batch": {
        "label": "批量价",
        "factor": 1,
        "note": "连接器按批量价格执行，当前默认基准。"
      },
      "protocol": {
        "label": "协议价",
        "factor": 1.06,
        "note": "协议价阶段，价格略高于批量价。"
      },
      "sample": {
        "label": "样品价",
        "factor": 1.18,
        "note": "样品/试装阶段，单价显著高于批量。"
      }
    },
    "labor": {
      "base": {
        "label": "当前基准",
        "factor": 1,
        "note": "按当前工时和费率计算。"
      },
      "optimize": {
        "label": "优化版",
        "factor": 0.94,
        "note": "工艺优化、平衡线与节拍提升。"
      },
      "ramp": {
        "label": "爬坡版",
        "factor": 1.08,
        "note": "产线爬坡和加班导致工时损耗。"
      }
    },
    "equipment": {
      "base": {
        "label": "当前资源",
        "factor": 1,
        "note": "按现有设备资源投入与占用计算。"
      },
      "shared": {
        "label": "共享产线",
        "factor": 0.95,
        "note": "共享产线后，设备分摊下降。"
      },
      "dedicated": {
        "label": "新增专线",
        "factor": 1.08,
        "note": "新增专线或资源冗余，设备分摊上升。"
      }
    },
    "packaging": {
      "base": {
        "label": "当前方案",
        "factor": 1,
        "note": "按当前包装、运费、仓储组合。"
      },
      "optimize": {
        "label": "轻包装",
        "factor": 0.92,
        "note": "包装优化和线路优化后，物流成本下降。"
      },
      "longhaul": {
        "label": "远途加价",
        "factor": 1.12,
        "note": "远途运输或仓储波动带来物流上升。"
      }
    },
    "vave": {
      "none": {
        "label": "无VAVE",
        "savings": 0,
        "note": "不叠加额外降本。"
      },
      "normal": {
        "label": "常规VAVE",
        "savings": 1.8,
        "note": "常规优化，按 1.8 元/套降本。"
      },
      "aggressive": {
        "label": "攻坚VAVE",
        "savings": 4.5,
        "note": "攻坚项目，按 4.5 元/套降本。"
      }
    }
  }
}
,
  bomChanges: [
  {
    "action": "替换",
    "part": "主高压电缆",
    "from": "铜基标准线",
    "to": "铝基轻量线",
    "resource": "裁线 / 压接 / 测试",
    "obsoleteQty": 180,
    "obsoleteValue": 12600,
    "equipmentDelta": 0.08,
    "laborDelta": 0.06,
    "packagingDelta": 0.03,
    "configs": [
      "CM020",
      "CM030"
    ],
    "stock": "旧铜基尾料优先转用 / 分批消化",
    "note": "铜铝切换后需要重新校准裁线余量。"
  },
  {
    "action": "新增",
    "part": "端子护套",
    "from": "无",
    "to": "高压密封护套",
    "resource": "装配 / 热缩",
    "obsoleteQty": 0,
    "obsoleteValue": 0,
    "equipmentDelta": 0.03,
    "laborDelta": 0.03,
    "packagingDelta": 0.01,
    "configs": [
      "CM015",
      "CM020",
      "CM030"
    ],
    "stock": "无",
    "note": "新护套带来新增工位动作和包装保护。"
  },
  {
    "action": "取消",
    "part": "单层胶带",
    "from": "单层胶带",
    "to": "复合缠绕方案",
    "resource": "缠绕机 / 返修工位",
    "obsoleteQty": 120,
    "obsoleteValue": 4600,
    "equipmentDelta": -0.04,
    "laborDelta": -0.04,
    "packagingDelta": -0.01,
    "configs": [
      "CM010",
      "CM015"
    ],
    "stock": "剩余胶带优先内部消耗 / 低值报废",
    "note": "包扎方式升级后，旧胶带库存需要转呆滞。"
  },
  {
    "action": "替换",
    "part": "支架总成",
    "from": "钢支架",
    "to": "复合支架",
    "resource": "扭力枪 / 夹具",
    "obsoleteQty": 65,
    "obsoleteValue": 5200,
    "equipmentDelta": -0.01,
    "laborDelta": -0.02,
    "packagingDelta": 0,
    "configs": [
      "CM020"
    ],
    "stock": "旧件分批消化",
    "note": "轻量化支架减重，但需要重新校验装配节拍。"
  },
  {
    "action": "新增",
    "part": "防呆标签",
    "from": "无",
    "to": "二维码防错标签",
    "resource": "打印 / 贴标",
    "obsoleteQty": 0,
    "obsoleteValue": 0,
    "equipmentDelta": 0.01,
    "laborDelta": 0.02,
    "packagingDelta": 0.02,
    "configs": [
      "CM010",
      "CM015",
      "CM020",
      "CM030"
    ],
    "stock": "无",
    "note": "标签动作直接联动配置防错。"
  },
  {
    "action": "替换",
    "part": "包装内衬",
    "from": "EPE内衬",
    "to": "纸浆模塑内衬",
    "resource": "包装线 / 装箱",
    "obsoleteQty": 240,
    "obsoleteValue": 3100,
    "equipmentDelta": 0,
    "laborDelta": 0.01,
    "packagingDelta": -0.08,
    "configs": [
      "CM030"
    ],
    "stock": "旧内衬按呆滞评估 / 退库可用",
    "note": "包装替换优先降低物流成本。"
  },
  {
    "action": "替换",
    "part": "连接器套件",
    "from": "样品价连接器",
    "to": "协议价 / 批量价连接器",
    "resource": "压接 / 插接 / 检验",
    "obsoleteQty": 42,
    "obsoleteValue": 2800,
    "equipmentDelta": 0.02,
    "laborDelta": -0.01,
    "packagingDelta": 0,
    "configs": [
      "CM020",
      "CM030"
    ],
    "stock": "样件转研发领用或退库",
    "note": "连接器价格版本切换后，样件库存要独立闭环。"
  }
],
  historySeed: [
  {
    "id": "H-20260324-001",
    "name": "基准版本",
    "scenarioName": "G281 基准生命周期场景",
    "state": {
      "bom": "freeze",
      "connector": "batch",
      "labor": "base",
      "equipment": "base",
      "packaging": "base",
      "vave": "none"
    },
    "draft": {
      "scenarioName": "G281 基准生命周期场景",
      "copperPrice": 69300,
      "aluminumPrice": 18500,
      "directHours": 1.13,
      "directRate": 35,
      "manufacturingHours": 0.47,
      "manufacturingRate": 47,
      "packInner": 3.2,
      "packFreight": 4.1,
      "packWarehouse": 2.95,
      "packOther": 2.3943008441667,
      "bomWireDrawing": 820,
      "bomWireEat": 35,
      "bomWireHidden": 18,
      "bomTapeDiameter": 8.5,
      "bomTapeWidth": 19,
      "bomTapeOverlap": 35,
      "mix": [
        10,
        40,
        35,
        15
      ],
      "volumes": [
        85000,
        135000,
        125000,
        114000,
        94000,
        47000
      ],
      "asp": [
        484.196845551355,
        479.251857437304,
        479.251857437304,
        479.251857437304,
        479.251857437304,
        479.251857437304
      ]
    },
    "createdAt": "2026-03-24T01:45:00+08:00",
    "author": "system",
    "note": "来自当前工作簿基准版本，用于定点价和利润基线。",
    "summary": {
      "revenue": 287971438.45,
      "cost": 269401494.96,
      "profit": 18569943.49,
      "margin": 0.0644853656,
      "paybackYears": 6.4841261223,
      "capitalTotal": 20068309.28
    }
  },
  {
    "id": "H-20260324-002",
    "name": "轻量化试算版",
    "scenarioName": "G281 轻量化试算场景",
    "state": {
      "bom": "light",
      "connector": "protocol",
      "labor": "optimize",
      "equipment": "shared",
      "packaging": "optimize",
      "vave": "normal"
    },
    "draft": {
      "scenarioName": "G281 轻量化试算场景",
      "copperPrice": 68400,
      "aluminumPrice": 18200,
      "directHours": 1.08,
      "directRate": 34.6,
      "manufacturingHours": 0.43,
      "manufacturingRate": 46.2,
      "packInner": 3,
      "packFreight": 3.85,
      "packWarehouse": 2.72,
      "packOther": 2.2,
      "bomWireDrawing": 792,
      "bomWireEat": 31,
      "bomWireHidden": 15,
      "bomTapeDiameter": 8.1,
      "bomTapeWidth": 19,
      "bomTapeOverlap": 32,
      "mix": [
        12,
        42,
        33,
        13
      ],
      "volumes": [
        90000,
        142000,
        132000,
        120000,
        98000,
        51000
      ],
      "asp": [
        484.196845551355,
        479.251857437304,
        479.251857437304,
        479.251857437304,
        479.251857437304,
        479.251857437304
      ]
    },
    "createdAt": "2026-03-24T02:05:00+08:00",
    "author": "system",
    "note": "用于验证 BOM 轻量化、连接器协议价和工时优化组合。",
    "summary": {
      "revenue": 302110980.68,
      "cost": 270721285.01,
      "profit": 31389695.67,
      "margin": 0.1039012074,
      "paybackYears": 3.8359676035,
      "capitalTotal": 20068309.28
    }
  },
  {
    "id": "H-20260324-003",
    "name": "资源爬坡压力版",
    "scenarioName": "G281 资源爬坡压力场景",
    "state": {
      "bom": "regress",
      "connector": "sample",
      "labor": "ramp",
      "equipment": "dedicated",
      "packaging": "longhaul",
      "vave": "aggressive"
    },
    "draft": {
      "scenarioName": "G281 资源爬坡压力场景",
      "copperPrice": 72800,
      "aluminumPrice": 19250,
      "directHours": 1.21,
      "directRate": 36.5,
      "manufacturingHours": 0.54,
      "manufacturingRate": 49,
      "packInner": 3.38,
      "packFreight": 4.85,
      "packWarehouse": 3.2,
      "packOther": 2.86,
      "bomWireDrawing": 835,
      "bomWireEat": 38,
      "bomWireHidden": 22,
      "bomTapeDiameter": 9.1,
      "bomTapeWidth": 19,
      "bomTapeOverlap": 40,
      "mix": [
        8,
        35,
        37,
        20
      ],
      "volumes": [
        72000,
        110000,
        118000,
        109000,
        90000,
        43000
      ],
      "asp": [
        484.196845551355,
        479.251857437304,
        479.251857437304,
        479.251857437304,
        479.251857437304,
        479.251857437304
      ]
    },
    "createdAt": "2026-03-24T02:18:00+08:00",
    "author": "system",
    "note": "用于模拟试制、爬坡和远途物流带来的成本压力。",
    "summary": {
      "revenue": 262970331.99,
      "cost": 272514187.26,
      "profit": -9543855.27,
      "margin": -0.0362925171,
      "paybackYears": null,
      "capitalTotal": 20068309.28
    }
  }
]
,
  approvalSeed: [
  {
    "id": "A-20260324-001",
    "title": "基准版本审批",
    "relatedVersionId": "H-20260324-001",
    "status": "APPROVED",
    "owner": "项目经理",
    "submittedAt": "2026-03-24T01:55:00+08:00",
    "approvedAt": "2026-03-24T02:10:00+08:00",
    "comment": "基准版本已完成定点成本核对，确认当前利润基线。"
  },
  {
    "id": "A-20260324-002",
    "title": "BOM 轻量化审批",
    "relatedVersionId": "H-20260324-002",
    "status": "PENDING",
    "owner": "成本工程师",
    "submittedAt": "2026-03-24T02:07:00+08:00",
    "approvedAt": "",
    "comment": "轻量化试算已提交，等待连接器协议价与工时优化联审。"
  },
  {
    "id": "A-20260324-003",
    "title": "资源爬坡评审",
    "relatedVersionId": "H-20260324-003",
    "status": "REVIEW",
    "owner": "制造工程",
    "submittedAt": "2026-03-24T02:20:00+08:00",
    "approvedAt": "",
    "comment": "当前处于评审中，等待工时、包装和物流联动确认。"
  }
]
,
  bomValidation: {
  "meta": {
    "generatedAt": "2026-03-25T12:42:18",
    "generator": "g281_generate_bom_validation.py",
    "version": "0.3.0",
    "comparisonMethod": "per-harness -> connector end groups / wires / sync-dev parts / materials",
    "quoteWorkbook": "G281项目 报价BOM V03-12.4.xlsx",
    "fixedWorkbook": "G281 国内项目 定点BOM V06-2026.01.20【变更履历待更新】.xlsx",
    "harnessCount": 11,
    "unmatchedHarnessCount": 0
  },
  "harnessOrder": [
    "6608442962",
    "6608442963",
    "6608442964",
    "6608442965",
    "6608442966",
    "6608491523",
    "6608491524",
    "6608507680",
    "6608516992",
    "6608519100",
    "6608544875"
  ],
  "comparisons": {
    "6608442962": {
      "harnessId": "6608442962",
      "harnessName": "直流母线总成",
      "quoteSheet": "6608442962",
      "fixedSheet": "6608442962-35方",
      "sources": {
        "quote": {
          "sheet": "6608442962",
          "itemCount": 13
        },
        "fixed": {
          "sheet": "6608442962-35方",
          "itemCount": 26
        }
      },
      "summary": {
        "groupCount": 6,
        "connectorGroupCount": 2,
        "syncGroupCount": 2,
        "quoteItemCount": 13,
        "fixedItemCount": 26,
        "matchedCount": 8,
        "quoteOnlyCount": 3,
        "fixedOnlyCount": 3,
        "assemblyToPartsCount": 2,
        "assemblyPartCount": 15,
        "wireMatchedCount": 0,
        "syncMatchedCount": 4,
        "materialMatchedCount": 8
      },
      "groups": [
        {
          "key": "battery_end",
          "label": "接电池端",
          "section": "connector",
          "quoteCount": 1,
          "fixedCount": 8,
          "matchedCount": 0,
          "quoteOnlyCount": 0,
          "fixedOnlyCount": 0,
          "assemblyToPartsCount": 1,
          "assemblyPartCount": 8,
          "aligned": [
            {
              "itemKey": "HVPC2P1600FV550-NH-P010",
              "status": "assembly_to_parts",
              "mappingType": "assembly_to_parts",
              "quote": {
                "itemKey": "HVPC2P1600FV550-NH-P010",
                "partNumber": "HVPC2P1600FV550-NH-P010",
                "partName": "连接器总成",
                "unit": "SET",
                "quantity": 1,
                "rowNumbers": [
                  5
                ],
                "functions": [
                  "接电池端"
                ],
                "remarks": [
                  "安费诺"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "安费诺"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [
                  "HVPC2P1600FV550-NH-P010"
                ],
                "kind": "connector",
                "groupKey": "battery_end"
              },
              "fixed": null,
              "fixedParts": [
                {
                  "itemKey": "HVPC2P1600FT5-NH-MP010",
                  "partNumber": "HVPC2P1600FT5-NH-MP010",
                  "partName": "护套（145度反装 A键位）",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    5
                  ],
                  "functions": [
                    "接电池端"
                  ],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105032"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02105032"
                  ],
                  "assemblyRefs": [
                    "HVPC2P1600FT535-NH-P010 接电池端 适配2*35mm²屏蔽铜包铝硅胶铝导线"
                  ],
                  "kind": "connector",
                  "groupKey": "battery_end"
                },
                {
                  "itemKey": "HVPC2P1600FT-09P010",
                  "partNumber": "HVPC2P1600FT-09P010",
                  "partName": "插头端子-单粒焊接",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    6
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03103389"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A03103389"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "battery_end"
                },
                {
                  "itemKey": "HVPC2P1600FV-15P010",
                  "partNumber": "HVPC2P1600FV-15P010",
                  "partName": "挡板",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    7
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02104375"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02104375"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "battery_end"
                },
                {
                  "itemKey": "HVPC2P1600FV-06-35P010",
                  "partNumber": "HVPC2P1600FV-06-35P010",
                  "partName": "插头外屏蔽环",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    8
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03103387"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A03103387"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "battery_end"
                },
                {
                  "itemKey": "HVC2P80FS1-47P010",
                  "partNumber": "HVC2P80FS1-47P010",
                  "partName": "插头屏蔽内环",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    9
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03103388"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A03103388"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "battery_end"
                },
                {
                  "itemKey": "HVPC2P1600FV-12-35P010",
                  "partNumber": "HVPC2P1600FV-12-35P010",
                  "partName": "插头线束密封圈",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    10
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105020"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02105020"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "battery_end"
                },
                {
                  "itemKey": "HVPC2P1600FV-11-35P010",
                  "partNumber": "HVPC2P1600FV-11-35P010",
                  "partName": "插头线卡",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    11
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105018"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02105018"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "battery_end"
                },
                {
                  "itemKey": "HVPC2P1600FV-10-35P010",
                  "partNumber": "HVPC2P1600FV-10-35P010",
                  "partName": "插头尾盖",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    12
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105019"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02105019"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "battery_end"
                }
              ]
            }
          ]
        },
        {
          "key": "edrive_end",
          "label": "接电驱端",
          "section": "connector",
          "quoteCount": 1,
          "fixedCount": 7,
          "matchedCount": 0,
          "quoteOnlyCount": 0,
          "fixedOnlyCount": 0,
          "assemblyToPartsCount": 1,
          "assemblyPartCount": 7,
          "aligned": [
            {
              "itemKey": "IPT2PFS050-S02P010",
              "status": "assembly_to_parts",
              "mappingType": "assembly_to_parts",
              "quote": {
                "itemKey": "IPT2PFS050-S02P010",
                "partNumber": "IPT2PFS050-S02P010",
                "partName": "IPT连接器总成（带焊接端子）",
                "unit": "SET",
                "quantity": 1,
                "rowNumbers": [
                  6
                ],
                "functions": [
                  "接电驱"
                ],
                "remarks": [
                  "安费诺"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "安费诺"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [
                  "IPT2PFS050-S02P010"
                ],
                "kind": "connector",
                "groupKey": "edrive_end"
              },
              "fixed": null,
              "fixedParts": [
                {
                  "itemKey": "N022525276C",
                  "partNumber": "N022525276C",
                  "partName": "焊接端子-70",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    13
                  ],
                  "functions": [
                    "接电驱端"
                  ],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03103440"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A03103440"
                  ],
                  "assemblyRefs": [
                    "IPT2PFS035-S02P010（安费诺） 接电驱端 适配2*35mm²屏蔽铜包铝硅胶铝导线"
                  ],
                  "kind": "connector",
                  "groupKey": "edrive_end"
                },
                {
                  "itemKey": "IPT2PFS035-GA-01P010",
                  "partNumber": "IPT2PFS035-GA-01P010",
                  "partName": "主体组合件",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    14
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02102660"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02102660"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "edrive_end"
                },
                {
                  "itemKey": "IPT2PFS-S01-35P010",
                  "partNumber": "IPT2PFS-S01-35P010",
                  "partName": "压接屏蔽内环-35",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    15
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03101954"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A03101954"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "edrive_end"
                },
                {
                  "itemKey": "IPT2PFS-S02-35P010",
                  "partNumber": "IPT2PFS-S02-35P010",
                  "partName": "压接屏蔽外环-35/50",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    16
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03101953"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A03101953"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "edrive_end"
                },
                {
                  "itemKey": "IPT2PFS-M04-35P010",
                  "partNumber": "IPT2PFS-M04-35P010",
                  "partName": "屏蔽固定件-16/25/35",
                  "unit": "PCS",
                  "quantity": 4,
                  "rowNumbers": [
                    17
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02102662"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02102662"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "edrive_end"
                },
                {
                  "itemKey": "IPT2PFS-R02-35P010",
                  "partNumber": "IPT2PFS-R02-35P010",
                  "partName": "密封圈-35",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    18
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02102663"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02102663"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "edrive_end"
                },
                {
                  "itemKey": "IPT2PFS-M05-35P010",
                  "partNumber": "IPT2PFS-M05-35P010",
                  "partName": "尾盖-35",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    19
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105144"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02105144"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "edrive_end"
                }
              ]
            }
          ]
        },
        {
          "key": "wires",
          "label": "导线",
          "section": "wire",
          "quoteCount": 1,
          "fixedCount": 1,
          "matchedCount": 0,
          "quoteOnlyCount": 1,
          "fixedOnlyCount": 1,
          "assemblyToPartsCount": 0,
          "assemblyPartCount": 0,
          "aligned": [
            {
              "itemKey": "FHLALR2GCCAATB2G/50.0/橙",
              "status": "quote_only",
              "quote": {
                "itemKey": "FHLALR2GCCAATB2G/50.0/橙",
                "partNumber": "FHLALR2GCCAATB2G/50.0/橙",
                "partName": "50mm²屏蔽镀锡铜包铝硅胶铝导线",
                "unit": "M",
                "quantity": 1.9,
                "rowNumbers": [
                  8
                ],
                "functions": [],
                "remarks": [
                  "太平洋/鑫宏业"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "太平洋/鑫宏业"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              },
              "fixed": null
            },
            {
              "itemKey": "FHLALR2GCCAATB2G/35.0/橙",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "FHLALR2GCCAATB2G/35.0/橙",
                "partNumber": "FHLALR2GCCAATB2G/35.0/橙",
                "partName": "35mm²屏蔽镀锡铜包铝硅胶铝导线",
                "unit": "M",
                "quantity": 1.96,
                "rowNumbers": [
                  21
                ],
                "functions": [],
                "remarks": [
                  "太平洋"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01103420"
                ],
                "suppliers": [
                  "太平洋"
                ],
                "sapNos": [
                  "A01103420"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            }
          ]
        },
        {
          "key": "sync_brackets",
          "label": "支架类（同步开发件）",
          "section": "sync",
          "quoteCount": 3,
          "fixedCount": 3,
          "matchedCount": 3,
          "quoteOnlyCount": 0,
          "fixedOnlyCount": 0,
          "assemblyToPartsCount": 0,
          "assemblyPartCount": 0,
          "aligned": [
            {
              "itemKey": "G281-HB-04",
              "status": "matched",
              "quote": {
                "itemKey": "G281-HB-04",
                "partNumber": "G281-HB-04",
                "partName": "塑料支架",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  11
                ],
                "functions": [],
                "remarks": [
                  "博昊/天久/华凯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "博昊/天久/华凯"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              },
              "fixed": {
                "itemKey": "G281-HB-04",
                "partNumber": "G281-HB-04",
                "partName": "塑料支架（带2个衬套）",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  24
                ],
                "functions": [],
                "remarks": [
                  "上海程达"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06102155"
                ],
                "suppliers": [
                  "上海程达"
                ],
                "sapNos": [
                  "A06102155"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              }
            },
            {
              "itemKey": "G281-ZJ-06",
              "status": "matched",
              "quote": {
                "itemKey": "G281-ZJ-06",
                "partNumber": "G281-ZJ-06",
                "partName": "金属支架",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  12
                ],
                "functions": [],
                "remarks": [
                  "恒伟林/贵龙/华凯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "恒伟林/贵龙/华凯"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              },
              "fixed": {
                "itemKey": "G281-ZJ-06",
                "partNumber": "G281-ZJ-06",
                "partName": "金属支架",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  25
                ],
                "functions": [],
                "remarks": [
                  "华凯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06102146"
                ],
                "suppliers": [
                  "华凯"
                ],
                "sapNos": [
                  "A06102146"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              }
            },
            {
              "itemKey": "G281-ZJ-07",
              "status": "matched",
              "quote": {
                "itemKey": "G281-ZJ-07",
                "partNumber": "G281-ZJ-07",
                "partName": "金属支架",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  13
                ],
                "functions": [],
                "remarks": [
                  "恒伟林/贵龙/华凯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "恒伟林/贵龙/华凯"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              },
              "fixed": {
                "itemKey": "G281-ZJ-07",
                "partNumber": "G281-ZJ-07",
                "partName": "金属支架",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  26
                ],
                "functions": [],
                "remarks": [
                  "华凯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06102145"
                ],
                "suppliers": [
                  "华凯"
                ],
                "sapNos": [
                  "A06102145"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              }
            }
          ]
        },
        {
          "key": "sync_rubber",
          "label": "橡胶件类（同步开发件）",
          "section": "sync",
          "quoteCount": 2,
          "fixedCount": 2,
          "matchedCount": 1,
          "quoteOnlyCount": 1,
          "fixedOnlyCount": 1,
          "assemblyToPartsCount": 0,
          "assemblyPartCount": 0,
          "aligned": [
            {
              "itemKey": "G281-XJ-06",
              "status": "matched",
              "quote": {
                "itemKey": "G281-XJ-06",
                "partNumber": "G281-XJ-06",
                "partName": "橡胶件",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  14
                ],
                "functions": [],
                "remarks": [
                  "恒伟林/远信/博昊/天乐"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "恒伟林/远信/博昊/天乐"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_rubber"
              },
              "fixed": {
                "itemKey": "G281-XJ-06",
                "partNumber": "G281-XJ-06",
                "partName": "橡胶件",
                "unit": "PCS",
                "quantity": 4,
                "rowNumbers": [
                  27
                ],
                "functions": [
                  "G281-XJ-06 2PCS改为沿用MS11-XJ-05"
                ],
                "remarks": [
                  "博昊"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "博昊"
                ],
                "sapNos": [],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_rubber"
              }
            },
            {
              "itemKey": "MS11-XJ-05",
              "status": "quote_only",
              "quote": {
                "itemKey": "MS11-XJ-05",
                "partNumber": "MS11-XJ-05",
                "partName": "橡胶件",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  15
                ],
                "functions": [],
                "remarks": [
                  "金坛博盟"
                ],
                "otherRemarks": [
                  "沿用"
                ],
                "wireNos": [
                  "A04032520"
                ],
                "suppliers": [
                  "金坛博盟"
                ],
                "sapNos": [
                  "A04032520"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_rubber"
              },
              "fixed": null
            },
            {
              "itemKey": "G281-XJ-09",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "G281-XJ-09",
                "partNumber": "G281-XJ-09",
                "partName": "橡胶件",
                "unit": "PCS",
                "quantity": 4,
                "rowNumbers": [
                  28
                ],
                "functions": [
                  "原G281-XJ-09"
                ],
                "remarks": [
                  "博昊"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "博昊"
                ],
                "sapNos": [],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_rubber"
              }
            }
          ]
        },
        {
          "key": "materials",
          "label": "其他物料",
          "section": "material",
          "quoteCount": 5,
          "fixedCount": 5,
          "matchedCount": 4,
          "quoteOnlyCount": 1,
          "fixedOnlyCount": 1,
          "assemblyToPartsCount": 0,
          "assemblyPartCount": 0,
          "aligned": [
            {
              "itemKey": "HS-125(2X)N20-30",
              "status": "quote_only",
              "quote": {
                "itemKey": "HS-125(2X)N20-30",
                "partNumber": "HS-125(2X)N20-30",
                "partName": "不带胶-热缩管",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  7
                ],
                "functions": [],
                "remarks": [
                  "深圳宏商/长春海达"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04030275"
                ],
                "suppliers": [
                  "深圳宏商/长春海达"
                ],
                "sapNos": [
                  "A04030275"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": null
            },
            {
              "itemKey": "SCS2165A016",
              "status": "matched",
              "quote": {
                "itemKey": "SCS2165A016",
                "partNumber": "SCS2165A016",
                "partName": "16OR橙色编织套管",
                "unit": "M",
                "quantity": 1.5,
                "rowNumbers": [
                  9
                ],
                "functions": [],
                "remarks": [
                  "骏鼎达/明鑫"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101476"
                ],
                "suppliers": [
                  "骏鼎达/明鑫"
                ],
                "sapNos": [
                  "A04101476"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "SCS2165A016",
                "partNumber": "SCS2165A016",
                "partName": "16OR橙色编织套管",
                "unit": "M",
                "quantity": 1.52,
                "rowNumbers": [
                  22
                ],
                "functions": [],
                "remarks": [
                  "骏鼎达"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101476"
                ],
                "suppliers": [
                  "骏鼎达"
                ],
                "sapNos": [
                  "A04101476"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "LY5016019-OR2",
              "status": "matched",
              "quote": {
                "itemKey": "LY5016019-OR2",
                "partNumber": "LY5016019-OR2",
                "partName": "橙色布基胶带",
                "unit": "M",
                "quantity": 4,
                "rowNumbers": [
                  10
                ],
                "functions": [],
                "remarks": [
                  "联益"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101159"
                ],
                "suppliers": [
                  "联益"
                ],
                "sapNos": [
                  "A04101159"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "LY5016019-OR2",
                "partNumber": "LY5016019-OR2",
                "partName": "橙色布基胶带",
                "unit": "M",
                "quantity": 4.6,
                "rowNumbers": [
                  23
                ],
                "functions": [],
                "remarks": [
                  "联益"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101159"
                ],
                "suppliers": [
                  "联益"
                ],
                "sapNos": [
                  "A04101159"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "111-00563",
              "status": "matched",
              "quote": {
                "itemKey": "111-00563",
                "partNumber": "111-00563",
                "partName": "扎带绳",
                "unit": "PCS",
                "quantity": 8,
                "rowNumbers": [
                  16
                ],
                "functions": [],
                "remarks": [
                  "上海众安/海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06010012"
                ],
                "suppliers": [
                  "上海众安/海尔曼太通"
                ],
                "sapNos": [
                  "A06010012"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "111-00563",
                "partNumber": "111-00563",
                "partName": "扎带绳",
                "unit": "PCS",
                "quantity": 8,
                "rowNumbers": [
                  29
                ],
                "functions": [],
                "remarks": [
                  "海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06010012"
                ],
                "suppliers": [
                  "海尔曼太通"
                ],
                "sapNos": [
                  "A06010012"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "X1-BQ-01标签140X30MM",
              "status": "matched",
              "quote": {
                "itemKey": "X1-BQ-01标签140X30MM",
                "partNumber": "X1-BQ-01 标签140x30mm",
                "partName": "产品标签",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  17
                ],
                "functions": [],
                "remarks": [
                  "洪众"
                ],
                "otherRemarks": [],
                "wireNos": [
                  "70002326"
                ],
                "suppliers": [
                  "洪众"
                ],
                "sapNos": [
                  "70002326"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "X1-BQ-01标签140X30MM",
                "partNumber": "X1-BQ-01 标签140x30mm",
                "partName": "产品标签",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  30
                ],
                "functions": [],
                "remarks": [
                  "洪众"
                ],
                "otherRemarks": [],
                "wireNos": [
                  "70002326"
                ],
                "suppliers": [
                  "洪众"
                ],
                "sapNos": [
                  "70002326"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "HS-125(3X)18-30",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "HS-125(3X)18-30",
                "partNumber": "HS-125(3X) 18-30",
                "partName": "不带胶-热缩管",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  20
                ],
                "functions": [],
                "remarks": [
                  "长春海达"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04102622"
                ],
                "suppliers": [
                  "长春海达"
                ],
                "sapNos": [
                  "A04102622"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            }
          ]
        }
      ]
    },
    "6608442963": {
      "harnessId": "6608442963",
      "harnessName": "电动压缩机线束总成",
      "quoteSheet": "6608442963",
      "fixedSheet": "6608442963",
      "sources": {
        "quote": {
          "sheet": "6608442963",
          "itemCount": 28
        },
        "fixed": {
          "sheet": "6608442963",
          "itemCount": 42
        }
      },
      "summary": {
        "groupCount": 7,
        "connectorGroupCount": 4,
        "syncGroupCount": 1,
        "quoteItemCount": 28,
        "fixedItemCount": 40,
        "matchedCount": 11,
        "quoteOnlyCount": 15,
        "fixedOnlyCount": 15,
        "assemblyToPartsCount": 2,
        "assemblyPartCount": 14,
        "wireMatchedCount": 0,
        "syncMatchedCount": 0,
        "materialMatchedCount": 5
      },
      "groups": [
        {
          "key": "battery_end",
          "label": "接电池端",
          "section": "connector",
          "quoteCount": 1,
          "fixedCount": 7,
          "matchedCount": 0,
          "quoteOnlyCount": 0,
          "fixedOnlyCount": 0,
          "assemblyToPartsCount": 1,
          "assemblyPartCount": 7,
          "aligned": [
            {
              "itemKey": "YGC1612-EV-PW2PNA2-4",
              "status": "assembly_to_parts",
              "mappingType": "assembly_to_parts",
              "quote": {
                "itemKey": "YGC1612-EV-PW2PNA2-4",
                "partNumber": "YGC1612-EV-PW2PNA2-4",
                "partName": "连接器总成",
                "unit": "SET",
                "quantity": 1,
                "rowNumbers": [
                  6
                ],
                "functions": [
                  "接电池端"
                ],
                "remarks": [
                  "永贵"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "永贵"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [
                  "YGC1612-EV-PW2PNA2-4"
                ],
                "kind": "connector",
                "groupKey": "battery_end"
              },
              "fixed": null,
              "fixedParts": [
                {
                  "itemKey": "113990002546",
                  "partNumber": "113990002546",
                  "partName": "YGC1612-EV-P2PWNA1插头组件",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    12
                  ],
                  "functions": [
                    "135度角度出线"
                  ],
                  "remarks": [
                    "永贵"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105150"
                  ],
                  "suppliers": [
                    "永贵"
                  ],
                  "sapNos": [
                    "A02105150"
                  ],
                  "assemblyRefs": [
                    "YGC1612-EV-P2PWNA1-4 135度角度出线 （永贵带50A保险，取消互锁，工具解锁） 接电池端 适配4mm²屏蔽铜包铝交联铝导线"
                  ],
                  "kind": "connector",
                  "groupKey": "battery_end"
                },
                {
                  "itemKey": "113020602561",
                  "partNumber": "113020602561",
                  "partName": "5.8×0.8WABOO3-(T40-T60)SW孔端子组件-链式",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    13
                  ],
                  "functions": [],
                  "remarks": [
                    "永贵"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03103441"
                  ],
                  "suppliers": [
                    "永贵"
                  ],
                  "sapNos": [
                    "A03103441"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "battery_end"
                },
                {
                  "itemKey": "113029800652",
                  "partNumber": "113029800652",
                  "partName": "5.8×0.8WAS002-(T40-T60)SW针端子组件-链式",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    14
                  ],
                  "functions": [],
                  "remarks": [
                    "永贵"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03103442"
                  ],
                  "suppliers": [
                    "永贵"
                  ],
                  "sapNos": [
                    "A03103442"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "battery_end"
                },
                {
                  "itemKey": "114022500495",
                  "partNumber": "114022500495",
                  "partName": "YG1467屏蔽件-外-4",
                  "unit": "PCS",
                  "quantity": 4,
                  "rowNumbers": [
                    15,
                    24
                  ],
                  "functions": [],
                  "remarks": [
                    "永贵"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03103443"
                  ],
                  "suppliers": [
                    "永贵"
                  ],
                  "sapNos": [
                    "A03103443"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "battery_end"
                },
                {
                  "itemKey": "114022500492",
                  "partNumber": "114022500492",
                  "partName": "YG1467屏蔽件-内-4",
                  "unit": "PCS",
                  "quantity": 4,
                  "rowNumbers": [
                    16,
                    23
                  ],
                  "functions": [],
                  "remarks": [
                    "永贵"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03103444"
                  ],
                  "suppliers": [
                    "永贵"
                  ],
                  "sapNos": [
                    "A03103444"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "battery_end"
                },
                {
                  "itemKey": "114069806819",
                  "partNumber": "114069806819",
                  "partName": "Ф6.7尾盖(黑)",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    19
                  ],
                  "functions": [],
                  "remarks": [
                    "永贵"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105148"
                  ],
                  "suppliers": [
                    "永贵"
                  ],
                  "sapNos": [
                    "A02105148"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "battery_end"
                },
                {
                  "itemKey": "114069807132",
                  "partNumber": "114069807132",
                  "partName": "Ф6尾盖1(黑)",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    20
                  ],
                  "functions": [],
                  "remarks": [
                    "永贵"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105147"
                  ],
                  "suppliers": [
                    "永贵"
                  ],
                  "sapNos": [
                    "A02105147"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "battery_end"
                }
              ]
            }
          ]
        },
        {
          "key": "accm_end",
          "label": "接ACCM端",
          "section": "connector",
          "quoteCount": 1,
          "fixedCount": 7,
          "matchedCount": 0,
          "quoteOnlyCount": 0,
          "fixedOnlyCount": 0,
          "assemblyToPartsCount": 1,
          "assemblyPartCount": 7,
          "aligned": [
            {
              "itemKey": "2521188-1",
              "status": "assembly_to_parts",
              "mappingType": "assembly_to_parts",
              "quote": {
                "itemKey": "2521188-1",
                "partNumber": "2521188-1",
                "partName": "连接器总成",
                "unit": "SET",
                "quantity": 1,
                "rowNumbers": [
                  5
                ],
                "functions": [
                  "接ACCM端"
                ],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [
                  "2521188-1"
                ],
                "kind": "connector",
                "groupKey": "accm_end"
              },
              "fixed": null,
              "fixedParts": [
                {
                  "itemKey": "2509744-1",
                  "partNumber": "2509744-1",
                  "partName": "护套",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    5
                  ],
                  "functions": [
                    "（泰科，取消互锁，工具解锁）"
                  ],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105029"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A02105029"
                  ],
                  "assemblyRefs": [
                    "2521188-1 （泰科，取消互锁，工具解锁） 接ACCM端 适配4mm²屏蔽铜包铝交联铝导线"
                  ],
                  "kind": "connector",
                  "groupKey": "accm_end"
                },
                {
                  "itemKey": "2508246-1",
                  "partNumber": "2508246-1",
                  "partName": "链式-焊接端子",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    6
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03102426"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A03102426"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "accm_end"
                },
                {
                  "itemKey": "2474445-5",
                  "partNumber": "2474445-5",
                  "partName": "外屏蔽环",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    7
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03103031"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A03103031"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "accm_end"
                },
                {
                  "itemKey": "1-2350495-3",
                  "partNumber": "1-2350495-3",
                  "partName": "内屏蔽环",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    8
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03032325"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A03032325"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "accm_end"
                },
                {
                  "itemKey": "2519472-1",
                  "partNumber": "2519472-1",
                  "partName": "挡板",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    9
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105028"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A02105028"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "accm_end"
                },
                {
                  "itemKey": "2474450-5",
                  "partNumber": "2474450-5",
                  "partName": "密封圈",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    10
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02104232"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A02104232"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "accm_end"
                },
                {
                  "itemKey": "2474448-5",
                  "partNumber": "2474448-5",
                  "partName": "尾盖",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    11
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02104233"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A02104233"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "accm_end"
                }
              ]
            }
          ]
        },
        {
          "key": "ptc_end",
          "label": "接PTC端",
          "section": "connector",
          "quoteCount": 4,
          "fixedCount": 3,
          "matchedCount": 1,
          "quoteOnlyCount": 3,
          "fixedOnlyCount": 2,
          "assemblyToPartsCount": 0,
          "assemblyPartCount": 0,
          "aligned": [
            {
              "itemKey": "112030106654",
              "status": "quote_only",
              "quote": {
                "itemKey": "112030106654",
                "partNumber": "112030106654",
                "partName": "插头组件",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  7
                ],
                "functions": [
                  "接PTC"
                ],
                "remarks": [
                  "永贵"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "永贵"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [
                  "YGC1176D-EV-S(2+2)PT/1"
                ],
                "kind": "connector",
                "groupKey": "ptc_end"
              },
              "fixed": null
            },
            {
              "itemKey": "114022500492",
              "status": "quote_only",
              "quote": {
                "itemKey": "114022500492",
                "partNumber": "114022500492",
                "partName": "屏蔽内套管",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  9
                ],
                "functions": [],
                "remarks": [
                  "永贵"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "永贵"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "ptc_end"
              },
              "fixed": null
            },
            {
              "itemKey": "114022500495",
              "status": "quote_only",
              "quote": {
                "itemKey": "114022500495",
                "partNumber": "114022500495",
                "partName": "屏蔽外套管",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  10
                ],
                "functions": [],
                "remarks": [
                  "永贵"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "永贵"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "ptc_end"
              },
              "fixed": null
            },
            {
              "itemKey": "113990001502",
              "status": "matched",
              "quote": {
                "itemKey": "113990001502",
                "partNumber": "113990001502",
                "partName": "尾盖组件",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  11
                ],
                "functions": [],
                "remarks": [
                  "永贵"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "永贵"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "ptc_end"
              },
              "fixed": {
                "itemKey": "113990001502",
                "partNumber": "113990001502",
                "partName": "Ф6尾盖组件",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  25
                ],
                "functions": [],
                "remarks": [
                  "永贵"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02105149"
                ],
                "suppliers": [
                  "永贵"
                ],
                "sapNos": [
                  "A02105149"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "ptc_end"
              }
            },
            {
              "itemKey": "112030109557",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "112030109557",
                "partNumber": "112030109557",
                "partName": "YGC1176D-EV-S(2+2)PT插头",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  21
                ],
                "functions": [
                  "YG1176D（永贵，取消互锁，工具解锁）"
                ],
                "remarks": [
                  "永贵"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "永贵"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [
                  "YGC1176D-EV-S(2+2)PT YG1176D（永贵，取消互锁，工具解锁） 接PTC 适配2*4mm²屏蔽铜包铝交联铝导线"
                ],
                "kind": "connector",
                "groupKey": "ptc_end"
              }
            },
            {
              "itemKey": "115490007801",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "115490007801",
                "partNumber": "115490007801",
                "partName": "链式-焊接端子",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  22
                ],
                "functions": [],
                "remarks": [
                  "永贵"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A03103445"
                ],
                "suppliers": [
                  "永贵"
                ],
                "sapNos": [
                  "A03103445"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "ptc_end"
              }
            }
          ]
        },
        {
          "key": "branch_splitter",
          "label": "分线器",
          "section": "connector",
          "quoteCount": 12,
          "fixedCount": 11,
          "matchedCount": 5,
          "quoteOnlyCount": 7,
          "fixedOnlyCount": 6,
          "assemblyToPartsCount": 0,
          "assemblyPartCount": 0,
          "aligned": [
            {
              "itemKey": "F02-372010-B04",
              "status": "matched",
              "quote": {
                "itemKey": "F02-372010-B04",
                "partNumber": "F02-372010-B04",
                "partName": "左尾盖",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  12
                ],
                "functions": [
                  "二分四分线器"
                ],
                "remarks": [
                  "八达"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "八达"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [
                  "F02-372011-110"
                ],
                "kind": "connector",
                "groupKey": "branch_splitter"
              },
              "fixed": {
                "itemKey": "F02-372010-B04",
                "partNumber": "F02-372010-B04",
                "partName": "左尾盖",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  26
                ],
                "functions": [
                  "二分四分线器"
                ],
                "remarks": [
                  "八达"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02104778"
                ],
                "suppliers": [
                  "八达"
                ],
                "sapNos": [
                  "A02104778"
                ],
                "assemblyRefs": [
                  "F02-372011-111 二分四分线器 适配6*4mm²屏蔽铜包铝交联铝导线"
                ],
                "kind": "connector",
                "groupKey": "branch_splitter"
              }
            },
            {
              "itemKey": "F02-372010-G01",
              "status": "matched",
              "quote": {
                "itemKey": "F02-372010-G01",
                "partNumber": "F02-372010-G01",
                "partName": "密封圈",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  13
                ],
                "functions": [],
                "remarks": [
                  "八达"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "八达"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "branch_splitter"
              },
              "fixed": {
                "itemKey": "F02-372010-G01",
                "partNumber": "F02-372010-G01",
                "partName": "密封圈",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  27
                ],
                "functions": [],
                "remarks": [
                  "八达"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02104777"
                ],
                "suppliers": [
                  "八达"
                ],
                "sapNos": [
                  "A02104777"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "branch_splitter"
              }
            },
            {
              "itemKey": "F02-372010-03H",
              "status": "matched",
              "quote": {
                "itemKey": "F02-372010-03H",
                "partNumber": "F02-372010-03H",
                "partName": "屏蔽环",
                "unit": "PCS",
                "quantity": 4,
                "rowNumbers": [
                  14
                ],
                "functions": [],
                "remarks": [
                  "八达"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "八达"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "branch_splitter"
              },
              "fixed": {
                "itemKey": "F02-372010-03H",
                "partNumber": "F02-372010-03H",
                "partName": "屏蔽环",
                "unit": "PCS",
                "quantity": 4,
                "rowNumbers": [
                  28
                ],
                "functions": [],
                "remarks": [
                  "八达"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A03103293"
                ],
                "suppliers": [
                  "八达"
                ],
                "sapNos": [
                  "A03103293"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "branch_splitter"
              }
            },
            {
              "itemKey": "F02-372010-B02",
              "status": "quote_only",
              "quote": {
                "itemKey": "F02-372010-B02",
                "partNumber": "F02-372010-B02",
                "partName": "上内壳体",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  15
                ],
                "functions": [],
                "remarks": [
                  "八达"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "八达"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "branch_splitter"
              },
              "fixed": null
            },
            {
              "itemKey": "F02-372010-07H",
              "status": "quote_only",
              "quote": {
                "itemKey": "F02-372010-07H",
                "partNumber": "F02-372010-07H",
                "partName": "上屏蔽罩",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  16
                ],
                "functions": [],
                "remarks": [
                  "八达"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "八达"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "branch_splitter"
              },
              "fixed": null
            },
            {
              "itemKey": "F02-372010-B03",
              "status": "quote_only",
              "quote": {
                "itemKey": "F02-372010-B03",
                "partNumber": "F02-372010-B03",
                "partName": "下内壳体",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  17
                ],
                "functions": [],
                "remarks": [
                  "八达"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "八达"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "branch_splitter"
              },
              "fixed": null
            },
            {
              "itemKey": "F02-372010-08H",
              "status": "quote_only",
              "quote": {
                "itemKey": "F02-372010-08H",
                "partNumber": "F02-372010-08H",
                "partName": "下屏蔽罩",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  18
                ],
                "functions": [],
                "remarks": [
                  "八达"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "八达"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "branch_splitter"
              },
              "fixed": null
            },
            {
              "itemKey": "F02-372010-04H",
              "status": "matched",
              "quote": {
                "itemKey": "F02-372010-04H",
                "partNumber": "F02-372010-04H",
                "partName": "屏蔽环",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  19
                ],
                "functions": [],
                "remarks": [
                  "八达"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "八达"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "branch_splitter"
              },
              "fixed": {
                "itemKey": "F02-372010-04H",
                "partNumber": "F02-372010-04H",
                "partName": "屏蔽环",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  33
                ],
                "functions": [],
                "remarks": [
                  "八达"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A03103292"
                ],
                "suppliers": [
                  "八达"
                ],
                "sapNos": [
                  "A03103292"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "branch_splitter"
              }
            },
            {
              "itemKey": "F02-372010-09B",
              "status": "quote_only",
              "quote": {
                "itemKey": "F02-372010-09B",
                "partNumber": "F02-372010-09B",
                "partName": "屏蔽内环",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  20
                ],
                "functions": [],
                "remarks": [
                  "八达"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "八达"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "branch_splitter"
              },
              "fixed": null
            },
            {
              "itemKey": "F11-001-000082",
              "status": "matched",
              "quote": {
                "itemKey": "F11-001-000082",
                "partNumber": "F11-001-000082",
                "partName": "护套",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  21
                ],
                "functions": [],
                "remarks": [
                  "八达"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "八达"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "branch_splitter"
              },
              "fixed": {
                "itemKey": "F11-001-000082",
                "partNumber": "F11-001-000082",
                "partName": "护套",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  34
                ],
                "functions": [],
                "remarks": [
                  "八达"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A05100590"
                ],
                "suppliers": [
                  "八达"
                ],
                "sapNos": [
                  "A05100590"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "branch_splitter"
              }
            },
            {
              "itemKey": "F02-372010-G06",
              "status": "quote_only",
              "quote": {
                "itemKey": "F02-372010-G06",
                "partNumber": "F02-372010-G06",
                "partName": "密封圈",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  22
                ],
                "functions": [],
                "remarks": [
                  "八达"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "八达"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "branch_splitter"
              },
              "fixed": null
            },
            {
              "itemKey": "F02-372010-B12",
              "status": "quote_only",
              "quote": {
                "itemKey": "F02-372010-B12",
                "partNumber": "F02-372010-B12",
                "partName": "尾盖",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  23
                ],
                "functions": [],
                "remarks": [
                  "八达"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "八达"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "branch_splitter"
              },
              "fixed": null
            },
            {
              "itemKey": "F02-372010-B06",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "F02-372010-B06",
                "partNumber": "F02-372010-B06",
                "partName": "上内壳体",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  29
                ],
                "functions": [],
                "remarks": [
                  "八达"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02105137"
                ],
                "suppliers": [
                  "八达"
                ],
                "sapNos": [
                  "A02105137"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "branch_splitter"
              }
            },
            {
              "itemKey": "F02-372010-05H",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "F02-372010-05H",
                "partNumber": "F02-372010-05H",
                "partName": "上屏蔽罩",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  30
                ],
                "functions": [],
                "remarks": [
                  "八达"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02105136"
                ],
                "suppliers": [
                  "八达"
                ],
                "sapNos": [
                  "A02105136"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "branch_splitter"
              }
            },
            {
              "itemKey": "F02-372010-B07",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "F02-372010-B07",
                "partNumber": "F02-372010-B07",
                "partName": "下内壳体",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  31
                ],
                "functions": [],
                "remarks": [
                  "八达"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02105139"
                ],
                "suppliers": [
                  "八达"
                ],
                "sapNos": [
                  "A02105139"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "branch_splitter"
              }
            },
            {
              "itemKey": "F02-372010-06H",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "F02-372010-06H",
                "partNumber": "F02-372010-06H",
                "partName": "下屏蔽罩",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  32
                ],
                "functions": [],
                "remarks": [
                  "八达"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02105138"
                ],
                "suppliers": [
                  "八达"
                ],
                "sapNos": [
                  "A02105138"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "branch_splitter"
              }
            },
            {
              "itemKey": "F02-372010-G04",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "F02-372010-G04",
                "partNumber": "F02-372010-G04",
                "partName": "密封圈",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  35
                ],
                "functions": [],
                "remarks": [
                  "八达"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02105134"
                ],
                "suppliers": [
                  "八达"
                ],
                "sapNos": [
                  "A02105134"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "branch_splitter"
              }
            },
            {
              "itemKey": "F02-372010-B08",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "F02-372010-B08",
                "partNumber": "F02-372010-B08",
                "partName": "尾盖",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  36
                ],
                "functions": [],
                "remarks": [
                  "八达"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02105135"
                ],
                "suppliers": [
                  "八达"
                ],
                "sapNos": [
                  "A02105135"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "branch_splitter"
              }
            }
          ]
        },
        {
          "key": "wires",
          "label": "导线",
          "section": "wire",
          "quoteCount": 1,
          "fixedCount": 1,
          "matchedCount": 0,
          "quoteOnlyCount": 1,
          "fixedOnlyCount": 1,
          "assemblyToPartsCount": 0,
          "assemblyPartCount": 0,
          "aligned": [
            {
              "itemKey": "FHLALR91XCCAATB91X/4.0/橙",
              "status": "quote_only",
              "quote": {
                "itemKey": "FHLALR91XCCAATB91X/4.0/橙",
                "partNumber": "FHLALR91XCCAATB91X/4.0/橙",
                "partName": "4.0mm²屏蔽镀锡铜包铝交联铝导线",
                "unit": "M",
                "quantity": 2.2,
                "rowNumbers": [
                  25
                ],
                "functions": [],
                "remarks": [
                  "太平洋/鑫宏业"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "太平洋/鑫宏业"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              },
              "fixed": null
            },
            {
              "itemKey": "FHLALR91XCCAATB91X/4.0/橙/AL8",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "FHLALR91XCCAATB91X/4.0/橙/AL8",
                "partNumber": "FHLALR91XCCAATB91X/4.0/橙/AL8",
                "partName": "4.0mm²屏蔽镀锡铜包铝交联铝导线",
                "unit": "M",
                "quantity": 2.72,
                "rowNumbers": [
                  37
                ],
                "functions": [],
                "remarks": [
                  "鑫宏业"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01103226"
                ],
                "suppliers": [
                  "鑫宏业"
                ],
                "sapNos": [
                  "A01103226"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            }
          ]
        },
        {
          "key": "sync_rubber",
          "label": "橡胶件类（同步开发件）",
          "section": "sync",
          "quoteCount": 0,
          "fixedCount": 1,
          "matchedCount": 0,
          "quoteOnlyCount": 0,
          "fixedOnlyCount": 1,
          "assemblyToPartsCount": 0,
          "assemblyPartCount": 0,
          "aligned": [
            {
              "itemKey": "G281-XJ-09",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "G281-XJ-09",
                "partNumber": "G281-XJ-09",
                "partName": "橡胶件",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  44
                ],
                "functions": [
                  "原G281-XJ-10"
                ],
                "remarks": [
                  "博昊"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "博昊"
                ],
                "sapNos": [],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_rubber"
              }
            }
          ]
        },
        {
          "key": "materials",
          "label": "其他物料",
          "section": "material",
          "quoteCount": 9,
          "fixedCount": 10,
          "matchedCount": 5,
          "quoteOnlyCount": 4,
          "fixedOnlyCount": 5,
          "assemblyToPartsCount": 0,
          "assemblyPartCount": 0,
          "aligned": [
            {
              "itemKey": "501021401627",
              "status": "quote_only",
              "quote": {
                "itemKey": "501021401627",
                "partNumber": "501021401627",
                "partName": "插针组件",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  8
                ],
                "functions": [],
                "remarks": [
                  "永贵"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "永贵"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": null
            },
            {
              "itemKey": "HS-1257.0-20",
              "status": "quote_only",
              "quote": {
                "itemKey": "HS-1257.0-20",
                "partNumber": "HS-125 7.0-20",
                "partName": "不带胶-热缩管",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  24
                ],
                "functions": [],
                "remarks": [
                  "深圳宏商/长春海达"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101984"
                ],
                "suppliers": [
                  "深圳宏商/长春海达"
                ],
                "sapNos": [
                  "A04101984"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": null
            },
            {
              "itemKey": "LG3305D012B",
              "status": "matched",
              "quote": {
                "itemKey": "LG3305D012B",
                "partNumber": "LG3305D012B",
                "partName": "12OR橙色波纹管",
                "unit": "M",
                "quantity": 0.45,
                "rowNumbers": [
                  26
                ],
                "functions": [],
                "remarks": [
                  "骏鼎达/诗兰姆"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101161"
                ],
                "suppliers": [
                  "骏鼎达/诗兰姆"
                ],
                "sapNos": [
                  "A04101161"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "LG3305D012B",
                "partNumber": "LG3305D012B",
                "partName": "12OR橙色波纹管",
                "unit": "M",
                "quantity": 0.45,
                "rowNumbers": [
                  38
                ],
                "functions": [],
                "remarks": [
                  "骏鼎达"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101161"
                ],
                "suppliers": [
                  "骏鼎达"
                ],
                "sapNos": [
                  "A04101161"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "LY5016019-OR2",
              "status": "matched",
              "quote": {
                "itemKey": "LY5016019-OR2",
                "partNumber": "LY5016019-OR2",
                "partName": "橙色布基胶带",
                "unit": "M",
                "quantity": 1,
                "rowNumbers": [
                  27
                ],
                "functions": [],
                "remarks": [
                  "联益"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101159"
                ],
                "suppliers": [
                  "联益"
                ],
                "sapNos": [
                  "A04101159"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "LY5016019-OR2",
                "partNumber": "LY5016019-OR2",
                "partName": "橙色布基胶带",
                "unit": "M",
                "quantity": 1.2,
                "rowNumbers": [
                  39
                ],
                "functions": [],
                "remarks": [
                  "联益"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101159"
                ],
                "suppliers": [
                  "联益"
                ],
                "sapNos": [
                  "A04101159"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "P111W0192510002",
              "status": "quote_only",
              "quote": {
                "itemKey": "P111W0192510002",
                "partNumber": "P111W0192510002",
                "partName": "橙色PVC胶带",
                "unit": "M",
                "quantity": 4,
                "rowNumbers": [
                  28
                ],
                "functions": [],
                "remarks": [
                  "亚化"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101670"
                ],
                "suppliers": [
                  "亚化"
                ],
                "sapNos": [
                  "A04101670"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": null
            },
            {
              "itemKey": "PP9108801",
              "status": "matched",
              "quote": {
                "itemKey": "PP9108801",
                "partNumber": "PP9108801",
                "partName": "7*12加高箭头扎带",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  29
                ],
                "functions": [],
                "remarks": [
                  "上海众安/海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06010236"
                ],
                "suppliers": [
                  "上海众安/海尔曼太通"
                ],
                "sapNos": [
                  "A06010236"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "PP9108801",
                "partNumber": "PP9108801",
                "partName": "7*12加高箭头扎带",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  41
                ],
                "functions": [],
                "remarks": [
                  "上海众安"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06010236"
                ],
                "suppliers": [
                  "上海众安"
                ],
                "sapNos": [
                  "A06010236"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "PP9114201",
              "status": "quote_only",
              "quote": {
                "itemKey": "PP9114201",
                "partNumber": "PP9114201",
                "partName": "M6抬高螺柱卡",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  30
                ],
                "functions": [],
                "remarks": [
                  "上海众安/海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06003890"
                ],
                "suppliers": [
                  "上海众安/海尔曼太通"
                ],
                "sapNos": [
                  "A06003890"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": null
            },
            {
              "itemKey": "PP9109401",
              "status": "matched",
              "quote": {
                "itemKey": "PP9109401",
                "partNumber": "PP9109401",
                "partName": "M6杉树卡扣",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  31
                ],
                "functions": [],
                "remarks": [
                  "上海众安/海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06003888"
                ],
                "suppliers": [
                  "上海众安/海尔曼太通"
                ],
                "sapNos": [
                  "A06003888"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "PP9109401",
                "partNumber": "PP9109401",
                "partName": "M6杉树卡扣",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  43
                ],
                "functions": [],
                "remarks": [
                  "上海众安"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06003888"
                ],
                "suppliers": [
                  "上海众安"
                ],
                "sapNos": [
                  "A06003888"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "X1-BQ-01标签140X30MM",
              "status": "matched",
              "quote": {
                "itemKey": "X1-BQ-01标签140X30MM",
                "partNumber": "X1-BQ-01 标签140x30mm",
                "partName": "产品标签",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  32
                ],
                "functions": [],
                "remarks": [
                  "洪众"
                ],
                "otherRemarks": [],
                "wireNos": [
                  "70002326"
                ],
                "suppliers": [
                  "洪众"
                ],
                "sapNos": [
                  "70002326"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "X1-BQ-01标签140X30MM",
                "partNumber": "X1-BQ-01 标签140x30mm",
                "partName": "产品标签",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  46
                ],
                "functions": [],
                "remarks": [
                  "洪众"
                ],
                "otherRemarks": [],
                "wireNos": [
                  "70002326"
                ],
                "suppliers": [
                  "洪众"
                ],
                "sapNos": [
                  "70002326"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "114050501799",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "114050501799",
                "partNumber": "114050501799",
                "partName": "YGEV2-1封线体-13.9",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  17
                ],
                "functions": [],
                "remarks": [
                  "永贵"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02101178"
                ],
                "suppliers": [
                  "永贵"
                ],
                "sapNos": [
                  "A02101178"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "114050502508",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "114050502508",
                "partNumber": "114050502508",
                "partName": "YG1612-1封线体-Ф3.9",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  18
                ],
                "functions": [],
                "remarks": [
                  "永贵"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02105146"
                ],
                "suppliers": [
                  "永贵"
                ],
                "sapNos": [
                  "A02105146"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "P111W0192510003",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "P111W0192510003",
                "partNumber": "P111W0192510003",
                "partName": "橙色PVC胶带",
                "unit": "M",
                "quantity": 4,
                "rowNumbers": [
                  40
                ],
                "functions": [],
                "remarks": [
                  "亚化"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101791"
                ],
                "suppliers": [
                  "亚化"
                ],
                "sapNos": [
                  "A04101791"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "156-03490",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "156-03490",
                "partNumber": "156-03490",
                "partName": "T5抬高螺柱卡",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  42
                ],
                "functions": [],
                "remarks": [
                  "海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06101040"
                ],
                "suppliers": [
                  "海尔曼太通"
                ],
                "sapNos": [
                  "A06101040"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "111-00563",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "111-00563",
                "partNumber": "111-00563",
                "partName": "扎带绳",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  45
                ],
                "functions": [],
                "remarks": [
                  "海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06010012"
                ],
                "suppliers": [
                  "海尔曼太通"
                ],
                "sapNos": [
                  "A06010012"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            }
          ]
        }
      ]
    },
    "6608442964": {
      "harnessId": "6608442964",
      "harnessName": "电动压缩机线束总成",
      "quoteSheet": "6608442964",
      "fixedSheet": "6608442964",
      "sources": {
        "quote": {
          "sheet": "6608442964",
          "itemCount": 10
        },
        "fixed": {
          "sheet": "6608442964",
          "itemCount": 25
        }
      },
      "summary": {
        "groupCount": 4,
        "connectorGroupCount": 2,
        "syncGroupCount": 0,
        "quoteItemCount": 10,
        "fixedItemCount": 25,
        "matchedCount": 4,
        "quoteOnlyCount": 4,
        "fixedOnlyCount": 7,
        "assemblyToPartsCount": 2,
        "assemblyPartCount": 14,
        "wireMatchedCount": 0,
        "syncMatchedCount": 0,
        "materialMatchedCount": 4
      },
      "groups": [
        {
          "key": "battery_end",
          "label": "接电池端",
          "section": "connector",
          "quoteCount": 1,
          "fixedCount": 7,
          "matchedCount": 0,
          "quoteOnlyCount": 0,
          "fixedOnlyCount": 0,
          "assemblyToPartsCount": 1,
          "assemblyPartCount": 7,
          "aligned": [
            {
              "itemKey": "YGC1612-EV-PW2PNA2-4",
              "status": "assembly_to_parts",
              "mappingType": "assembly_to_parts",
              "quote": {
                "itemKey": "YGC1612-EV-PW2PNA2-4",
                "partNumber": "YGC1612-EV-PW2PNA2-4",
                "partName": "连接器总成",
                "unit": "SET",
                "quantity": 1,
                "rowNumbers": [
                  6
                ],
                "functions": [
                  "接电池端"
                ],
                "remarks": [
                  "永贵"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "永贵"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [
                  "YGC1612-EV-PW2PNA2-4"
                ],
                "kind": "connector",
                "groupKey": "battery_end"
              },
              "fixed": null,
              "fixedParts": [
                {
                  "itemKey": "113990002546",
                  "partNumber": "113990002546",
                  "partName": "YGC1612-EV-P2PWNA1插头组件",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    12
                  ],
                  "functions": [
                    "135度角度出线"
                  ],
                  "remarks": [
                    "永贵"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105150"
                  ],
                  "suppliers": [
                    "永贵"
                  ],
                  "sapNos": [
                    "A02105150"
                  ],
                  "assemblyRefs": [
                    "YGC1612-EV-P2PWNA1-4 135度角度出线 （永贵带50A保险，取消互锁，工具解锁） 接电池端 适配4mm²屏蔽铜包铝交联铝导线"
                  ],
                  "kind": "connector",
                  "groupKey": "battery_end"
                },
                {
                  "itemKey": "113020602561",
                  "partNumber": "113020602561",
                  "partName": "5.8×0.8WABOO3-(T40-T60)SW孔端子组件-链式",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    13
                  ],
                  "functions": [],
                  "remarks": [
                    "永贵"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03103441"
                  ],
                  "suppliers": [
                    "永贵"
                  ],
                  "sapNos": [
                    "A03103441"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "battery_end"
                },
                {
                  "itemKey": "113029800652",
                  "partNumber": "113029800652",
                  "partName": "5.8×0.8WAS002-(T40-T60)SW针端子组件-链式",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    14
                  ],
                  "functions": [],
                  "remarks": [
                    "永贵"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03103442"
                  ],
                  "suppliers": [
                    "永贵"
                  ],
                  "sapNos": [
                    "A03103442"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "battery_end"
                },
                {
                  "itemKey": "114022500495",
                  "partNumber": "114022500495",
                  "partName": "YG1467屏蔽件-外-4",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    15
                  ],
                  "functions": [],
                  "remarks": [
                    "永贵"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03103443"
                  ],
                  "suppliers": [
                    "永贵"
                  ],
                  "sapNos": [
                    "A03103443"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "battery_end"
                },
                {
                  "itemKey": "114022500492",
                  "partNumber": "114022500492",
                  "partName": "YG1467屏蔽件-内-4",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    16
                  ],
                  "functions": [],
                  "remarks": [
                    "永贵"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03103444"
                  ],
                  "suppliers": [
                    "永贵"
                  ],
                  "sapNos": [
                    "A03103444"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "battery_end"
                },
                {
                  "itemKey": "114069806819",
                  "partNumber": "114069806819",
                  "partName": "Ф6.7尾盖(黑)",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    19
                  ],
                  "functions": [],
                  "remarks": [
                    "永贵"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105148"
                  ],
                  "suppliers": [
                    "永贵"
                  ],
                  "sapNos": [
                    "A02105148"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "battery_end"
                },
                {
                  "itemKey": "114069807132",
                  "partNumber": "114069807132",
                  "partName": "Ф6尾盖1(黑)",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    20
                  ],
                  "functions": [],
                  "remarks": [
                    "永贵"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105147"
                  ],
                  "suppliers": [
                    "永贵"
                  ],
                  "sapNos": [
                    "A02105147"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "battery_end"
                }
              ]
            }
          ]
        },
        {
          "key": "accm_end",
          "label": "接ACCM端",
          "section": "connector",
          "quoteCount": 1,
          "fixedCount": 7,
          "matchedCount": 0,
          "quoteOnlyCount": 0,
          "fixedOnlyCount": 0,
          "assemblyToPartsCount": 1,
          "assemblyPartCount": 7,
          "aligned": [
            {
              "itemKey": "2521188-1",
              "status": "assembly_to_parts",
              "mappingType": "assembly_to_parts",
              "quote": {
                "itemKey": "2521188-1",
                "partNumber": "2521188-1",
                "partName": "连接器总成",
                "unit": "SET",
                "quantity": 1,
                "rowNumbers": [
                  5
                ],
                "functions": [
                  "接ACCM端"
                ],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [
                  "2521188-1"
                ],
                "kind": "connector",
                "groupKey": "accm_end"
              },
              "fixed": null,
              "fixedParts": [
                {
                  "itemKey": "2509744-1",
                  "partNumber": "2509744-1",
                  "partName": "护套",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    5
                  ],
                  "functions": [
                    "（泰科，取消互锁，工具解锁）"
                  ],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105029"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A02105029"
                  ],
                  "assemblyRefs": [
                    "2521188-1 （泰科，取消互锁，工具解锁） 接ACCM端 适配4mm²屏蔽铜包铝交联铝导线"
                  ],
                  "kind": "connector",
                  "groupKey": "accm_end"
                },
                {
                  "itemKey": "2508246-1",
                  "partNumber": "2508246-1",
                  "partName": "链式-焊接端子",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    6
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03102426"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A03102426"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "accm_end"
                },
                {
                  "itemKey": "2474445-5",
                  "partNumber": "2474445-5",
                  "partName": "外屏蔽环",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    7
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03103031"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A03103031"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "accm_end"
                },
                {
                  "itemKey": "1-2350495-3",
                  "partNumber": "1-2350495-3",
                  "partName": "内屏蔽环",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    8
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03032325"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A03032325"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "accm_end"
                },
                {
                  "itemKey": "2519472-1",
                  "partNumber": "2519472-1",
                  "partName": "挡板",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    9
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105028"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A02105028"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "accm_end"
                },
                {
                  "itemKey": "2474450-5",
                  "partNumber": "2474450-5",
                  "partName": "密封圈",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    10
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02104232"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A02104232"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "accm_end"
                },
                {
                  "itemKey": "2474448-5",
                  "partNumber": "2474448-5",
                  "partName": "尾盖",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    11
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02104233"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A02104233"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "accm_end"
                }
              ]
            }
          ]
        },
        {
          "key": "wires",
          "label": "导线",
          "section": "wire",
          "quoteCount": 1,
          "fixedCount": 1,
          "matchedCount": 0,
          "quoteOnlyCount": 1,
          "fixedOnlyCount": 1,
          "assemblyToPartsCount": 0,
          "assemblyPartCount": 0,
          "aligned": [
            {
              "itemKey": "FHLALR91XCCAATB91X/4.0/橙",
              "status": "quote_only",
              "quote": {
                "itemKey": "FHLALR91XCCAATB91X/4.0/橙",
                "partNumber": "FHLALR91XCCAATB91X/4.0/橙",
                "partName": "4.0mm²屏蔽镀锡铜包铝交联铝导线",
                "unit": "M",
                "quantity": 1.5,
                "rowNumbers": [
                  7
                ],
                "functions": [],
                "remarks": [
                  "太平洋/鑫宏业"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "太平洋/鑫宏业"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              },
              "fixed": null
            },
            {
              "itemKey": "FHLALR91XCCAATB91X/4.0/橙/AL8",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "FHLALR91XCCAATB91X/4.0/橙/AL8",
                "partNumber": "FHLALR91XCCAATB91X/4.0/橙/AL8",
                "partName": "4.0mm²屏蔽镀锡铜包铝交联铝导线",
                "unit": "M",
                "quantity": 1.59,
                "rowNumbers": [
                  21
                ],
                "functions": [],
                "remarks": [
                  "鑫宏业"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01103226"
                ],
                "suppliers": [
                  "鑫宏业"
                ],
                "sapNos": [
                  "A01103226"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            }
          ]
        },
        {
          "key": "materials",
          "label": "其他物料",
          "section": "material",
          "quoteCount": 7,
          "fixedCount": 10,
          "matchedCount": 4,
          "quoteOnlyCount": 3,
          "fixedOnlyCount": 6,
          "assemblyToPartsCount": 0,
          "assemblyPartCount": 0,
          "aligned": [
            {
              "itemKey": "LG3305D012B",
              "status": "matched",
              "quote": {
                "itemKey": "LG3305D012B",
                "partNumber": "LG3305D012B",
                "partName": "12OR橙色波纹管",
                "unit": "M",
                "quantity": 0.55,
                "rowNumbers": [
                  8
                ],
                "functions": [],
                "remarks": [
                  "骏鼎达/诗兰姆"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101161"
                ],
                "suppliers": [
                  "骏鼎达/诗兰姆"
                ],
                "sapNos": [
                  "A04101161"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "LG3305D012B",
                "partNumber": "LG3305D012B",
                "partName": "12OR橙色波纹管",
                "unit": "M",
                "quantity": 0.55,
                "rowNumbers": [
                  22
                ],
                "functions": [],
                "remarks": [
                  "骏鼎达"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101161"
                ],
                "suppliers": [
                  "骏鼎达"
                ],
                "sapNos": [
                  "A04101161"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "LY5016019-OR2",
              "status": "matched",
              "quote": {
                "itemKey": "LY5016019-OR2",
                "partNumber": "LY5016019-OR2",
                "partName": "橙色布基胶带",
                "unit": "M",
                "quantity": 0.4,
                "rowNumbers": [
                  9
                ],
                "functions": [],
                "remarks": [
                  "联益"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101159"
                ],
                "suppliers": [
                  "联益"
                ],
                "sapNos": [
                  "A04101159"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "LY5016019-OR2",
                "partNumber": "LY5016019-OR2",
                "partName": "橙色布基胶带",
                "unit": "M",
                "quantity": 1.2,
                "rowNumbers": [
                  23
                ],
                "functions": [],
                "remarks": [
                  "联益"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101159"
                ],
                "suppliers": [
                  "联益"
                ],
                "sapNos": [
                  "A04101159"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "P111W0192510002",
              "status": "quote_only",
              "quote": {
                "itemKey": "P111W0192510002",
                "partNumber": "P111W0192510002",
                "partName": "橙色PVC胶带",
                "unit": "M",
                "quantity": 2,
                "rowNumbers": [
                  10
                ],
                "functions": [],
                "remarks": [
                  "亚化"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101670"
                ],
                "suppliers": [
                  "亚化"
                ],
                "sapNos": [
                  "A04101670"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": null
            },
            {
              "itemKey": "PP9122201",
              "status": "quote_only",
              "quote": {
                "itemKey": "PP9122201",
                "partNumber": "PP9122201",
                "partName": "M6竖置螺柱卡",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  11
                ],
                "functions": [],
                "remarks": [
                  "上海众安/海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06101666"
                ],
                "suppliers": [
                  "上海众安/海尔曼太通"
                ],
                "sapNos": [
                  "A06101666"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": null
            },
            {
              "itemKey": "PP9114201",
              "status": "quote_only",
              "quote": {
                "itemKey": "PP9114201",
                "partNumber": "PP9114201",
                "partName": "M6抬高螺柱卡",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  12
                ],
                "functions": [],
                "remarks": [
                  "上海众安/海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06003890"
                ],
                "suppliers": [
                  "上海众安/海尔曼太通"
                ],
                "sapNos": [
                  "A06003890"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": null
            },
            {
              "itemKey": "PP9109401",
              "status": "matched",
              "quote": {
                "itemKey": "PP9109401",
                "partNumber": "PP9109401",
                "partName": "M6杉树卡扣",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  13
                ],
                "functions": [],
                "remarks": [
                  "上海众安/海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06003888"
                ],
                "suppliers": [
                  "上海众安/海尔曼太通"
                ],
                "sapNos": [
                  "A06003888"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "PP9109401",
                "partNumber": "PP9109401",
                "partName": "M6杉树卡扣",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  27
                ],
                "functions": [],
                "remarks": [
                  "上海众安"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06003888"
                ],
                "suppliers": [
                  "上海众安"
                ],
                "sapNos": [
                  "A06003888"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "X1-BQ-01标签140X30MM",
              "status": "matched",
              "quote": {
                "itemKey": "X1-BQ-01标签140X30MM",
                "partNumber": "X1-BQ-01 标签140x30mm",
                "partName": "产品标签",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  14
                ],
                "functions": [],
                "remarks": [
                  "洪众"
                ],
                "otherRemarks": [],
                "wireNos": [
                  "70002326"
                ],
                "suppliers": [
                  "洪众"
                ],
                "sapNos": [
                  "70002326"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "X1-BQ-01标签140X30MM",
                "partNumber": "X1-BQ-01 标签140x30mm",
                "partName": "产品标签",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  29
                ],
                "functions": [],
                "remarks": [
                  "洪众"
                ],
                "otherRemarks": [],
                "wireNos": [
                  "70002326"
                ],
                "suppliers": [
                  "洪众"
                ],
                "sapNos": [
                  "70002326"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "114050501799",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "114050501799",
                "partNumber": "114050501799",
                "partName": "YGEV2-1封线体-13.9",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  17
                ],
                "functions": [],
                "remarks": [
                  "永贵"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02101178"
                ],
                "suppliers": [
                  "永贵"
                ],
                "sapNos": [
                  "A02101178"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "114050502508",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "114050502508",
                "partNumber": "114050502508",
                "partName": "YG1612-1封线体-Ф3.9",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  18
                ],
                "functions": [],
                "remarks": [
                  "永贵"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02105146"
                ],
                "suppliers": [
                  "永贵"
                ],
                "sapNos": [
                  "A02105146"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "P111W0192510003",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "P111W0192510003",
                "partNumber": "P111W0192510003",
                "partName": "橙色PVC胶带",
                "unit": "M",
                "quantity": 2,
                "rowNumbers": [
                  24
                ],
                "functions": [],
                "remarks": [
                  "亚化"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101791"
                ],
                "suppliers": [
                  "亚化"
                ],
                "sapNos": [
                  "A04101791"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "PP9118501",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "PP9118501",
                "partNumber": "PP9118501",
                "partName": "7*12竖向杉树卡",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  25
                ],
                "functions": [],
                "remarks": [
                  "上海众安"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06004939"
                ],
                "suppliers": [
                  "上海众安"
                ],
                "sapNos": [
                  "A06004939"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "156-03490",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "156-03490",
                "partNumber": "156-03490",
                "partName": "T5抬高螺柱卡",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  26
                ],
                "functions": [],
                "remarks": [
                  "海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06101040"
                ],
                "suppliers": [
                  "海尔曼太通"
                ],
                "sapNos": [
                  "A06101040"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "111-00563",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "111-00563",
                "partNumber": "111-00563",
                "partName": "扎带绳",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  28
                ],
                "functions": [],
                "remarks": [
                  "海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06010012"
                ],
                "suppliers": [
                  "海尔曼太通"
                ],
                "sapNos": [
                  "A06010012"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            }
          ]
        }
      ]
    },
    "6608442965": {
      "harnessId": "6608442965",
      "harnessName": "组合式充电插座线束总成",
      "quoteSheet": "6608442965",
      "fixedSheet": "6608442965",
      "sources": {
        "quote": {
          "sheet": "6608442965",
          "itemCount": 46
        },
        "fixed": {
          "sheet": "6608442965",
          "itemCount": 98
        }
      },
      "summary": {
        "groupCount": 11,
        "connectorGroupCount": 7,
        "syncGroupCount": 2,
        "quoteItemCount": 46,
        "fixedItemCount": 95,
        "matchedCount": 26,
        "quoteOnlyCount": 15,
        "fixedOnlyCount": 39,
        "assemblyToPartsCount": 5,
        "assemblyPartCount": 30,
        "wireMatchedCount": 4,
        "syncMatchedCount": 8,
        "materialMatchedCount": 19
      },
      "groups": [
        {
          "key": "charge_socket",
          "label": "充电插座",
          "section": "connector",
          "quoteCount": 1,
          "fixedCount": 15,
          "matchedCount": 0,
          "quoteOnlyCount": 0,
          "fixedOnlyCount": 0,
          "assemblyToPartsCount": 1,
          "assemblyPartCount": 15,
          "aligned": [
            {
              "itemKey": "2523328-1",
              "status": "assembly_to_parts",
              "mappingType": "assembly_to_parts",
              "quote": {
                "itemKey": "2523328-1",
                "partNumber": "2523328-1",
                "partName": "组合式充电插座(带防尘盖)",
                "unit": "SET",
                "quantity": 1,
                "rowNumbers": [
                  5
                ],
                "functions": [
                  "组合式充电插座(带电子锁，防尘盖)"
                ],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [
                  "2523328-1"
                ],
                "kind": "connector",
                "groupKey": "charge_socket"
              },
              "fixed": null,
              "fixedParts": [
                {
                  "itemKey": "2519063-1",
                  "partNumber": "2519063-1",
                  "partName": "防尘盖组件",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    5
                  ],
                  "functions": [
                    "组合式充电插座(带电子锁，防尘盖)"
                  ],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105132"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A02105132"
                  ],
                  "assemblyRefs": [
                    "2523328-1 组合式充电插座(带电子锁，防尘盖) DC：120mm²非屏蔽硅胶铝导线 AC：6mm²非屏蔽铝导线 DC接地：6mm²非屏蔽黄绿铜导线 AC接地：5mm²非屏蔽黄绿铜导线"
                  ],
                  "kind": "connector",
                  "groupKey": "charge_socket"
                },
                {
                  "itemKey": "2521766-1",
                  "partNumber": "2521766-1",
                  "partName": "直流壳体组件",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    7
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A05100637"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A05100637"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "charge_socket"
                },
                {
                  "itemKey": "2495482-6",
                  "partNumber": "2495482-6",
                  "partName": "DC-焊接端子组件",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    8
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03103436"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A03103436"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "charge_socket"
                },
                {
                  "itemKey": "2521057-1",
                  "partNumber": "2521057-1",
                  "partName": "DC-PE-压接端子",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    9
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A05100556"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A05100556"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "charge_socket"
                },
                {
                  "itemKey": "2411162-9",
                  "partNumber": "2411162-9",
                  "partName": "密封圈-DC-焊接端子",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    10
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02104529"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A02104529"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "charge_socket"
                },
                {
                  "itemKey": "2403723-6",
                  "partNumber": "2403723-6",
                  "partName": "PE线密封圈",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    11
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02104531"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A02104531"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "charge_socket"
                },
                {
                  "itemKey": "2403722-7",
                  "partNumber": "2403722-7",
                  "partName": "PE尾盖",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    12
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02104533"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A02104533"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "charge_socket"
                },
                {
                  "itemKey": "2406408-1",
                  "partNumber": "2406408-1",
                  "partName": "DC线密封圈",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    13
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105133"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A02105133"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "charge_socket"
                },
                {
                  "itemKey": "2406406-1",
                  "partNumber": "2406406-1",
                  "partName": "DC尾盖",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    14
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105131"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A02105131"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "charge_socket"
                },
                {
                  "itemKey": "2517495-1",
                  "partNumber": "2517495-1",
                  "partName": "交流壳体组件",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    15
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A05100636"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A05100636"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "charge_socket"
                },
                {
                  "itemKey": "2519345-1",
                  "partNumber": "2519345-1",
                  "partName": "AC+AC-PE焊接端子",
                  "unit": "PCS",
                  "quantity": 3,
                  "rowNumbers": [
                    16
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03103175"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A03103175"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "charge_socket"
                },
                {
                  "itemKey": "2500438-1",
                  "partNumber": "2500438-1",
                  "partName": "密封圈-AC+AC-PE焊接端子",
                  "unit": "PCS",
                  "quantity": 3,
                  "rowNumbers": [
                    17
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02104528"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A02104528"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "charge_socket"
                },
                {
                  "itemKey": "2499861-1",
                  "partNumber": "2499861-1",
                  "partName": "AC+PE尾盖",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    18
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A05100560"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A05100560"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "charge_socket"
                },
                {
                  "itemKey": "2483376-2",
                  "partNumber": "2483376-2",
                  "partName": "电子锁",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    19
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A05100635"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A05100635"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "charge_socket"
                },
                {
                  "itemKey": "2518993-4",
                  "partNumber": "2518993-4",
                  "partName": "电子锁拉绳",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    20
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A05100634"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A05100634"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "charge_socket"
                }
              ]
            }
          ]
        },
        {
          "key": "dc_charge_end",
          "label": "快充端",
          "section": "connector",
          "quoteCount": 2,
          "fixedCount": 7,
          "matchedCount": 1,
          "quoteOnlyCount": 0,
          "fixedOnlyCount": 0,
          "assemblyToPartsCount": 1,
          "assemblyPartCount": 6,
          "aligned": [
            {
              "itemKey": "1-2438787-1",
              "status": "matched",
              "quote": {
                "itemKey": "1-2438787-1",
                "partNumber": "1-2438787-1",
                "partName": "低压连接器总成（10PIN，10个端子，10个防水栓）",
                "unit": "SET",
                "quantity": 1,
                "rowNumbers": [
                  7
                ],
                "functions": [
                  "DC 10PIN低压信号连接器"
                ],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [
                  "1-2438787-1"
                ],
                "kind": "connector",
                "groupKey": "dc_charge_end"
              },
              "fixed": {
                "itemKey": "1-2438787-1",
                "partNumber": "1-2438787-1",
                "partName": "DC端低压插件-8pin",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  23
                ],
                "functions": [
                  "DC 8PIN低压信号连接器"
                ],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02100365"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "A02100365"
                ],
                "assemblyRefs": [
                  "1-2438787-1 DC 8PIN低压信号连接器 适配8*0.5mm²线"
                ],
                "kind": "connector",
                "groupKey": "dc_charge_end"
              }
            },
            {
              "itemKey": "HVSPC2P1900FV112",
              "status": "assembly_to_parts",
              "mappingType": "assembly_to_parts",
              "quote": {
                "itemKey": "HVSPC2P1900FV112",
                "partNumber": "HVSPC2P1900FV112",
                "partName": "ODP端连接器（直流）",
                "unit": "SET",
                "quantity": 1,
                "rowNumbers": [
                  13
                ],
                "functions": [
                  "快充连接器（直流）"
                ],
                "remarks": [
                  "安费诺"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "安费诺"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [
                  "HVSPC2P1900FV112"
                ],
                "kind": "connector",
                "groupKey": "dc_charge_end"
              },
              "fixed": null,
              "fixedParts": [
                {
                  "itemKey": "7-2435189-1",
                  "partNumber": "7-2435189-1",
                  "partName": "低压线端子-链式压接",
                  "unit": "PCS",
                  "quantity": 13,
                  "rowNumbers": [
                    24,
                    27
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03033043"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A03033043"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "dc_charge_end"
                },
                {
                  "itemKey": "5-2435022-1",
                  "partNumber": "5-2435022-1",
                  "partName": "低压线防水栓",
                  "unit": "PCS",
                  "quantity": 17,
                  "rowNumbers": [
                    25,
                    28,
                    32
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03100681"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A03100681"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "dc_charge_end"
                },
                {
                  "itemKey": "HVSPC2P1900FV1-M",
                  "partNumber": "HVSPC2P1900FV1-M",
                  "partName": "护套-正插Code A0-90度",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    41
                  ],
                  "functions": [
                    "快充连接器（直流）"
                  ],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105124"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02105124"
                  ],
                  "assemblyRefs": [
                    "HVSPC2P1900FV112 快充连接器（直流） 适配2*120mm²非屏蔽硅胶铝导线 ESOW：HVSPC2P1900FV112（安费诺，120方非屏蔽、CodeA、带互锁、90°正插） 3D数据：Code A0 90度 安费诺提供资料：180度"
                  ],
                  "kind": "connector",
                  "groupKey": "dc_charge_end"
                },
                {
                  "itemKey": "HVPC2P1900FV-06",
                  "partNumber": "HVPC2P1900FV-06",
                  "partName": "端子",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    42
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03103434"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A03103434"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "dc_charge_end"
                },
                {
                  "itemKey": "HVPC2P1900FV-08",
                  "partNumber": "HVPC2P1900FV-08",
                  "partName": "密封圈挡板",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    43
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02104536"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02104536"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "dc_charge_end"
                },
                {
                  "itemKey": "HVPC2P1900FV-0985",
                  "partNumber": "HVPC2P1900FV-0985",
                  "partName": "120mm²密封圈",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    44
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105127"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02105127"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "dc_charge_end"
                }
              ]
            }
          ]
        },
        {
          "key": "ac_charge_end",
          "label": "慢充端",
          "section": "connector",
          "quoteCount": 2,
          "fixedCount": 6,
          "matchedCount": 0,
          "quoteOnlyCount": 0,
          "fixedOnlyCount": 0,
          "assemblyToPartsCount": 2,
          "assemblyPartCount": 6,
          "aligned": [
            {
              "itemKey": "1-2355517-1",
              "status": "assembly_to_parts",
              "mappingType": "assembly_to_parts",
              "quote": {
                "itemKey": "1-2355517-1",
                "partNumber": "1-2355517-1",
                "partName": "低压连接器总成（5PIN，5个端子，5个防水栓）",
                "unit": "SET",
                "quantity": 1,
                "rowNumbers": [
                  6
                ],
                "functions": [
                  "AC 5PIN低压信号连接器"
                ],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [
                  "1-2355517-1"
                ],
                "kind": "connector",
                "groupKey": "ac_charge_end"
              },
              "fixed": null,
              "fixedParts": [
                {
                  "itemKey": "1-2355517-5",
                  "partNumber": "1-2355517-5",
                  "partName": "AC端低压插件-5pin",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    26
                  ],
                  "functions": [
                    "AC 6PIN低压信号连接器,"
                  ],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02034551"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A02034551"
                  ],
                  "assemblyRefs": [
                    "1-2355517-5 AC 6PIN低压信号连接器, 6#不使用 适配5*0.5方单芯铜导线"
                  ],
                  "kind": "connector",
                  "groupKey": "ac_charge_end"
                }
              ]
            },
            {
              "itemKey": "HVC2PG263UFSW106-NH",
              "status": "assembly_to_parts",
              "mappingType": "assembly_to_parts",
              "quote": {
                "itemKey": "HVC2PG263UFSW106-NH",
                "partNumber": "HVC2PG263UFSW106-NH",
                "partName": "ODP端连接器（交流）",
                "unit": "SET",
                "quantity": 1,
                "rowNumbers": [
                  14
                ],
                "functions": [
                  "慢充端连接器（交流）"
                ],
                "remarks": [
                  "安费诺"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "安费诺"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [
                  "HVC2PG263UFSW106-NH"
                ],
                "kind": "connector",
                "groupKey": "ac_charge_end"
              },
              "fixed": null,
              "fixedParts": [
                {
                  "itemKey": "HVC2PG263FSW1-M-NH-P010",
                  "partNumber": "HVC2PG263FSW1-M-NH-P010",
                  "partName": "插头组件Code A 无高压互锁",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    47
                  ],
                  "functions": [
                    "慢充连接器（交流）"
                  ],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02104803"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02104803"
                  ],
                  "assemblyRefs": [
                    "HVC2PG263UFSW106-NH 慢充连接器（交流） 适配2*6mm²非屏蔽铝导线 （安费诺，取消互锁，工具解锁，6方非屏蔽铝线，超声波焊接）"
                  ],
                  "kind": "connector",
                  "groupKey": "ac_charge_end"
                },
                {
                  "itemKey": "N022525343C-P010",
                  "partNumber": "N022525343C-P010",
                  "partName": "6.3母端子(2.5-6mm²)",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    48
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03101971"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A03101971"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "ac_charge_end"
                },
                {
                  "itemKey": "HVC2P63FS-10-0902-P010",
                  "partNumber": "HVC2P63FS-10-0902-P010",
                  "partName": "HVC2P63-02线束密封圈 白色",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    49
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105128"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02105128"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "ac_charge_end"
                },
                {
                  "itemKey": "HVC2P63UFS-21-0306-P010",
                  "partNumber": "HVC2P63UFS-21-0306-P010",
                  "partName": "HVC2P63插头06非屏蔽线卡 紫色",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    50
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105123"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02105123"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "ac_charge_end"
                },
                {
                  "itemKey": "HVC2P63UFS-22-0306-P010",
                  "partNumber": "HVC2P63UFS-22-0306-P010",
                  "partName": "HVC2P63插头06非屏蔽后盖 紫色",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    51
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105126"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02105126"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "ac_charge_end"
                }
              ]
            }
          ]
        },
        {
          "key": "electronic_lock",
          "label": "电子锁",
          "section": "connector",
          "quoteCount": 2,
          "fixedCount": 3,
          "matchedCount": 0,
          "quoteOnlyCount": 1,
          "fixedOnlyCount": 0,
          "assemblyToPartsCount": 1,
          "assemblyPartCount": 3,
          "aligned": [
            {
              "itemKey": "805-122-541",
              "status": "assembly_to_parts",
              "mappingType": "assembly_to_parts",
              "quote": {
                "itemKey": "805-122-541",
                "partNumber": "805-122-541",
                "partName": "护套",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  15
                ],
                "functions": [
                  "电子锁低压连接器总成"
                ],
                "remarks": [
                  "赫尔斯曼"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02000642"
                ],
                "suppliers": [
                  "赫尔斯曼"
                ],
                "sapNos": [
                  "A02000642"
                ],
                "assemblyRefs": [
                  "805-122-541"
                ],
                "kind": "connector",
                "groupKey": "electronic_lock"
              },
              "fixed": null,
              "fixedParts": [
                {
                  "itemKey": "2298159-1",
                  "partNumber": "2298159-1",
                  "partName": "电子锁低压插件-4pin",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    30
                  ],
                  "functions": [
                    "电子锁低压连接器总成"
                  ],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02033733"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A02033733"
                  ],
                  "assemblyRefs": [
                    "2298159-1 电子锁低压连接器总成 适配4*0.5mm²单芯铜导线"
                  ],
                  "kind": "connector",
                  "groupKey": "electronic_lock"
                },
                {
                  "itemKey": "5-965906-1",
                  "partNumber": "5-965906-1",
                  "partName": "电子锁低压端子-链式压接",
                  "unit": "PCS",
                  "quantity": 4,
                  "rowNumbers": [
                    31
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03030931"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A03030931"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "electronic_lock"
                },
                {
                  "itemKey": "10106502",
                  "partNumber": "10106502",
                  "partName": "带胶-热缩管",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    56
                  ],
                  "functions": [
                    "电子锁低压线并线焊接热缩"
                  ],
                  "remarks": [
                    "深圳宏商"
                  ],
                  "otherRemarks": [
                    "★"
                  ],
                  "wireNos": [
                    "A04032307"
                  ],
                  "suppliers": [
                    "深圳宏商"
                  ],
                  "sapNos": [
                    "A04032307"
                  ],
                  "assemblyRefs": [
                    "电子锁低压线并线焊接热缩"
                  ],
                  "kind": "connector",
                  "groupKey": "electronic_lock"
                }
              ]
            },
            {
              "itemKey": "32140734123",
              "status": "quote_only",
              "quote": {
                "itemKey": "32140734123",
                "partNumber": "32140734123",
                "partName": "端子",
                "unit": "PCS",
                "quantity": 4,
                "rowNumbers": [
                  16
                ],
                "functions": [],
                "remarks": [
                  "科世达"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A03032316"
                ],
                "suppliers": [
                  "科世达"
                ],
                "sapNos": [
                  "A03032316"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "electronic_lock"
              },
              "fixed": null
            }
          ]
        },
        {
          "key": "low_voltage_inline",
          "label": "低压连接器",
          "section": "connector",
          "quoteCount": 2,
          "fixedCount": 7,
          "matchedCount": 2,
          "quoteOnlyCount": 0,
          "fixedOnlyCount": 5,
          "assemblyToPartsCount": 0,
          "assemblyPartCount": 0,
          "aligned": [
            {
              "itemKey": "5-2385463-1",
              "status": "matched",
              "quote": {
                "itemKey": "5-2385463-1",
                "partNumber": "5-2385463-1",
                "partName": "护套塑壳",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  8
                ],
                "functions": [
                  "低压连接器总成"
                ],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02101947"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "A02101947"
                ],
                "assemblyRefs": [
                  "5-2385463-1"
                ],
                "kind": "connector",
                "groupKey": "low_voltage_inline"
              },
              "fixed": {
                "itemKey": "5-2385463-1",
                "partNumber": "5-2385463-1",
                "partName": "护套塑壳",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  33
                ],
                "functions": [
                  "低压inline连接器总成，22pin使用16pin"
                ],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02101947"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "A02101947"
                ],
                "assemblyRefs": [
                  "5-2385463-1 低压inline连接器总成，22pin使用16pin 4#8#13#15#16#22#不使用 适配16*0.5mm²单芯铜导线"
                ],
                "kind": "connector",
                "groupKey": "low_voltage_inline"
              }
            },
            {
              "itemKey": "2377023-2",
              "status": "matched",
              "quote": {
                "itemKey": "2377023-2",
                "partNumber": "2377023-2",
                "partName": "端子",
                "unit": "PCS",
                "quantity": 18,
                "rowNumbers": [
                  9
                ],
                "functions": [],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A03033091"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "A03033091"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "low_voltage_inline"
              },
              "fixed": {
                "itemKey": "2377023-2",
                "partNumber": "2377023-2",
                "partName": "0.64型端子",
                "unit": "PCS",
                "quantity": 15,
                "rowNumbers": [
                  34
                ],
                "functions": [],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A03033091"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "A03033091"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "low_voltage_inline"
              }
            },
            {
              "itemKey": "2377789-2",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "2377789-2",
                "partNumber": "2377789-2",
                "partName": "1.2型端子",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  35
                ],
                "functions": [],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A03033363"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "A03033363"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "low_voltage_inline"
              }
            },
            {
              "itemKey": "2377665-4",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "2377665-4",
                "partNumber": "2377665-4",
                "partName": "防水栓（非1/8/15/22）-0.64型端子使用",
                "unit": "PCS",
                "quantity": 15,
                "rowNumbers": [
                  36
                ],
                "functions": [],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A03033097"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "A03033097"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "low_voltage_inline"
              }
            },
            {
              "itemKey": "963142-1",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "963142-1",
                "partNumber": "963142-1",
                "partName": "防水栓（1/8/15/22）-1.2型端子使用",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  37
                ],
                "functions": [],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A03030849"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "A03030849"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "low_voltage_inline"
              }
            },
            {
              "itemKey": "2377665-3",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "2377665-3",
                "partNumber": "2377665-3",
                "partName": "盲栓（非1/8/15/22）-0.64型端子使用",
                "unit": "PCS",
                "quantity": 3,
                "rowNumbers": [
                  38
                ],
                "functions": [],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02034386"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "A02034386"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "low_voltage_inline"
              }
            },
            {
              "itemKey": "963143-1",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "963143-1",
                "partNumber": "963143-1",
                "partName": "盲栓（1/8/15/22）-1.2型端子使用",
                "unit": "PCS",
                "quantity": 3,
                "rowNumbers": [
                  39
                ],
                "functions": [],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02031363"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "A02031363"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "low_voltage_inline"
              }
            }
          ]
        },
        {
          "key": "dc_ground",
          "label": "DC 接地端子",
          "section": "connector",
          "quoteCount": 1,
          "fixedCount": 1,
          "matchedCount": 0,
          "quoteOnlyCount": 1,
          "fixedOnlyCount": 1,
          "assemblyToPartsCount": 0,
          "assemblyPartCount": 0,
          "aligned": [
            {
              "itemKey": "K03006773",
              "status": "quote_only",
              "quote": {
                "itemKey": "K03006773",
                "partNumber": "K03006773",
                "partName": "DC接地端子",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  18
                ],
                "functions": [
                  "DC接地端子"
                ],
                "remarks": [
                  "丰迪/荣盛达"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "丰迪/荣盛达"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "dc_ground"
              },
              "fixed": null
            },
            {
              "itemKey": "K03005541",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "K03005541",
                "partNumber": "K03005541",
                "partName": "DC接地端子",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  53
                ],
                "functions": [
                  "DC接地端子"
                ],
                "remarks": [
                  "丰迪"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A03101932"
                ],
                "suppliers": [
                  "丰迪"
                ],
                "sapNos": [
                  "A03101932"
                ],
                "assemblyRefs": [
                  "DC接地端子"
                ],
                "kind": "connector",
                "groupKey": "dc_ground"
              }
            }
          ]
        },
        {
          "key": "ac_ground",
          "label": "AC 接地端子",
          "section": "connector",
          "quoteCount": 1,
          "fixedCount": 1,
          "matchedCount": 0,
          "quoteOnlyCount": 1,
          "fixedOnlyCount": 1,
          "assemblyToPartsCount": 0,
          "assemblyPartCount": 0,
          "aligned": [
            {
              "itemKey": "K03005541",
              "status": "quote_only",
              "quote": {
                "itemKey": "K03005541",
                "partNumber": "K03005541",
                "partName": "AC接地端子",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  19
                ],
                "functions": [
                  "AC接地端子"
                ],
                "remarks": [
                  "丰迪/荣盛达"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A03101932"
                ],
                "suppliers": [
                  "丰迪/荣盛达"
                ],
                "sapNos": [
                  "A03101932"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "ac_ground"
              },
              "fixed": null
            },
            {
              "itemKey": "K03006773",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "K03006773",
                "partNumber": "K03006773",
                "partName": "AC接地端子",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  52
                ],
                "functions": [
                  "AC接地端子"
                ],
                "remarks": [
                  "丰迪"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A03103446"
                ],
                "suppliers": [
                  "丰迪"
                ],
                "sapNos": [
                  "A03103446"
                ],
                "assemblyRefs": [
                  "AC接地端子"
                ],
                "kind": "connector",
                "groupKey": "ac_ground"
              }
            }
          ]
        },
        {
          "key": "wires",
          "label": "导线",
          "section": "wire",
          "quoteCount": 5,
          "fixedCount": 20,
          "matchedCount": 4,
          "quoteOnlyCount": 1,
          "fixedOnlyCount": 16,
          "assemblyToPartsCount": 0,
          "assemblyPartCount": 0,
          "aligned": [
            {
              "itemKey": "FHLALR2G/120.0/橙",
              "status": "matched",
              "quote": {
                "itemKey": "FHLALR2G/120.0/橙",
                "partNumber": "FHLALR2G/120.0/橙",
                "partName": "120mm²单芯非屏蔽铝导线",
                "unit": "M",
                "quantity": 2.4,
                "rowNumbers": [
                  21
                ],
                "functions": [],
                "remarks": [
                  "太平洋/鑫宏业/斯普乐"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01101891"
                ],
                "suppliers": [
                  "太平洋/鑫宏业/斯普乐"
                ],
                "sapNos": [
                  "A01101891"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              },
              "fixed": {
                "itemKey": "FHLALR2G/120.0/橙",
                "partNumber": "FHLALR2G/120.0/橙",
                "partName": "120mm²单芯非屏蔽铝导线",
                "unit": "M",
                "quantity": 2.4,
                "rowNumbers": [
                  57
                ],
                "functions": [],
                "remarks": [
                  "鑫宏业"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01101891"
                ],
                "suppliers": [
                  "鑫宏业"
                ],
                "sapNos": [
                  "A01101891"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            },
            {
              "itemKey": "FHLALR91X/6.0/橙",
              "status": "quote_only",
              "quote": {
                "itemKey": "FHLALR91X/6.0/橙",
                "partNumber": "FHLALR91X/6.0/橙",
                "partName": "6mm²单芯非屏蔽铝导线",
                "unit": "M",
                "quantity": 2.86,
                "rowNumbers": [
                  22
                ],
                "functions": [],
                "remarks": [
                  "鑫宏业/斯普乐"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "鑫宏业/斯普乐"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              },
              "fixed": null
            },
            {
              "itemKey": "FHL91X/6.0/黄绿",
              "status": "matched",
              "quote": {
                "itemKey": "FHL91X/6.0/黄绿",
                "partNumber": "FHL91X/6.0/黄绿",
                "partName": "6mm²单芯铜导线",
                "unit": "M",
                "quantity": 0.23,
                "rowNumbers": [
                  23
                ],
                "functions": [],
                "remarks": [
                  "鑫宏业/斯普乐"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01101944"
                ],
                "suppliers": [
                  "鑫宏业/斯普乐"
                ],
                "sapNos": [
                  "A01101944"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              },
              "fixed": {
                "itemKey": "FHL91X/6.0/黄绿",
                "partNumber": "FHL91X/6.0/黄绿",
                "partName": "6mm²单芯铜导线",
                "unit": "M",
                "quantity": 0.23,
                "rowNumbers": [
                  59
                ],
                "functions": [],
                "remarks": [
                  "鑫宏业"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01102926"
                ],
                "suppliers": [
                  "鑫宏业"
                ],
                "sapNos": [
                  "A01102926"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            },
            {
              "itemKey": "FHL91X/5.0/黄绿",
              "status": "matched",
              "quote": {
                "itemKey": "FHL91X/5.0/黄绿",
                "partNumber": "FHL91X/5.0/黄绿",
                "partName": "5mm²单芯铜导线",
                "unit": "M",
                "quantity": 0.25,
                "rowNumbers": [
                  24
                ],
                "functions": [],
                "remarks": [
                  "鑫宏业/斯普乐"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "鑫宏业/斯普乐"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              },
              "fixed": {
                "itemKey": "FHL91X/5.0/黄绿",
                "partNumber": "FHL91X/5.0/黄绿",
                "partName": "5mm²单芯铜导线",
                "unit": "M",
                "quantity": 0.25,
                "rowNumbers": [
                  60
                ],
                "functions": [],
                "remarks": [
                  "鑫宏业"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01103405"
                ],
                "suppliers": [
                  "鑫宏业"
                ],
                "sapNos": [
                  "A01103405"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            },
            {
              "itemKey": "FLRY-B/0.5/黑",
              "status": "matched",
              "quote": {
                "itemKey": "FLRY-B/0.5/黑",
                "partNumber": "FLRY-B/0.5/黑",
                "partName": "低压导线",
                "unit": "M",
                "quantity": 9.9,
                "rowNumbers": [
                  25
                ],
                "functions": [],
                "remarks": [
                  "福斯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01011796"
                ],
                "suppliers": [
                  "福斯"
                ],
                "sapNos": [
                  "A01011796"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              },
              "fixed": {
                "itemKey": "FLRY-B/0.5/黑",
                "partNumber": "FLRY-B/0.5/黑",
                "partName": "0.5低压导线",
                "unit": "M",
                "quantity": 1,
                "rowNumbers": [
                  65
                ],
                "functions": [],
                "remarks": [
                  "福斯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01011796"
                ],
                "suppliers": [
                  "福斯"
                ],
                "sapNos": [
                  "A01011796"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            },
            {
              "itemKey": "FHLAL91X/6.0/橙/AL8",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "FHLAL91X/6.0/橙/AL8",
                "partNumber": "FHLAL91X/6.0/橙/AL8",
                "partName": "6mm²单芯非屏蔽铝导线",
                "unit": "M",
                "quantity": 2.86,
                "rowNumbers": [
                  58
                ],
                "functions": [],
                "remarks": [
                  "鑫宏业"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01103404"
                ],
                "suppliers": [
                  "鑫宏业"
                ],
                "sapNos": [
                  "A01103404"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            },
            {
              "itemKey": "FLRY-B/0.5/棕兰",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "FLRY-B/0.5/棕兰",
                "partNumber": "FLRY-B/0.5/棕兰",
                "partName": "0.5低压导线",
                "unit": "M",
                "quantity": 0.56,
                "rowNumbers": [
                  61
                ],
                "functions": [],
                "remarks": [
                  "福斯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01011830"
                ],
                "suppliers": [
                  "福斯"
                ],
                "sapNos": [
                  "A01011830"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            },
            {
              "itemKey": "FLRY-B/0.5/棕",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "FLRY-B/0.5/棕",
                "partNumber": "FLRY-B/0.5/棕",
                "partName": "0.5低压导线",
                "unit": "M",
                "quantity": 0.51,
                "rowNumbers": [
                  62
                ],
                "functions": [],
                "remarks": [
                  "福斯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01011832"
                ],
                "suppliers": [
                  "福斯"
                ],
                "sapNos": [
                  "A01011832"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            },
            {
              "itemKey": "FLRY-B/0.5/兰黄",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "FLRY-B/0.5/兰黄",
                "partNumber": "FLRY-B/0.5/兰黄",
                "partName": "0.5低压导线",
                "unit": "M",
                "quantity": 0.51,
                "rowNumbers": [
                  63
                ],
                "functions": [],
                "remarks": [
                  "福斯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01011805"
                ],
                "suppliers": [
                  "福斯"
                ],
                "sapNos": [
                  "A01011805"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            },
            {
              "itemKey": "FLRY-B/0.5/红",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "FLRY-B/0.5/红",
                "partNumber": "FLRY-B/0.5/红",
                "partName": "0.5低压导线",
                "unit": "M",
                "quantity": 0.51,
                "rowNumbers": [
                  64
                ],
                "functions": [],
                "remarks": [
                  "福斯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01011755"
                ],
                "suppliers": [
                  "福斯"
                ],
                "sapNos": [
                  "A01011755"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            },
            {
              "itemKey": "FLRY-B/0.5/兰",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "FLRY-B/0.5/兰",
                "partNumber": "FLRY-B/0.5/兰",
                "partName": "0.5低压导线",
                "unit": "M",
                "quantity": 0.51,
                "rowNumbers": [
                  66
                ],
                "functions": [],
                "remarks": [
                  "福斯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01011808"
                ],
                "suppliers": [
                  "福斯"
                ],
                "sapNos": [
                  "A01011808"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            },
            {
              "itemKey": "FLRY-B/0.5/黄黑",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "FLRY-B/0.5/黄黑",
                "partNumber": "FLRY-B/0.5/黄黑",
                "partName": "0.5低压导线",
                "unit": "M",
                "quantity": 0.56,
                "rowNumbers": [
                  67
                ],
                "functions": [],
                "remarks": [
                  "福斯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01011774"
                ],
                "suppliers": [
                  "福斯"
                ],
                "sapNos": [
                  "A01011774"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            },
            {
              "itemKey": "FLRY-B/0.5/白",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "FLRY-B/0.5/白",
                "partNumber": "FLRY-B/0.5/白",
                "partName": "0.5低压导线",
                "unit": "M",
                "quantity": 0.56,
                "rowNumbers": [
                  68
                ],
                "functions": [],
                "remarks": [
                  "福斯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01011749"
                ],
                "suppliers": [
                  "福斯"
                ],
                "sapNos": [
                  "A01011749"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            },
            {
              "itemKey": "FLRY-B/0.5/黄",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "FLRY-B/0.5/黄",
                "partNumber": "FLRY-B/0.5/黄",
                "partName": "0.5低压导线",
                "unit": "M",
                "quantity": 0.56,
                "rowNumbers": [
                  69
                ],
                "functions": [],
                "remarks": [
                  "福斯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01011771"
                ],
                "suppliers": [
                  "福斯"
                ],
                "sapNos": [
                  "A01011771"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            },
            {
              "itemKey": "FLRY-B/0.5/黑白",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "FLRY-B/0.5/黑白",
                "partNumber": "FLRY-B/0.5/黑白",
                "partName": "0.5低压导线",
                "unit": "M",
                "quantity": 0.56,
                "rowNumbers": [
                  70
                ],
                "functions": [],
                "remarks": [
                  "福斯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01011792"
                ],
                "suppliers": [
                  "福斯"
                ],
                "sapNos": [
                  "A01011792"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            },
            {
              "itemKey": "FLRY-B/0.5/黄白",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "FLRY-B/0.5/黄白",
                "partNumber": "FLRY-B/0.5/黄白",
                "partName": "0.5低压导线",
                "unit": "M",
                "quantity": 0.56,
                "rowNumbers": [
                  71
                ],
                "functions": [],
                "remarks": [
                  "福斯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01011769"
                ],
                "suppliers": [
                  "福斯"
                ],
                "sapNos": [
                  "A01011769"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            },
            {
              "itemKey": "FLRY-B/0.5/红白",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "FLRY-B/0.5/红白",
                "partNumber": "FLRY-B/0.5/红白",
                "partName": "0.5低压导线",
                "unit": "M",
                "quantity": 0.56,
                "rowNumbers": [
                  72
                ],
                "functions": [],
                "remarks": [
                  "福斯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01011754"
                ],
                "suppliers": [
                  "福斯"
                ],
                "sapNos": [
                  "A01011754"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            },
            {
              "itemKey": "FLRY-B/0.5/绿白",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "FLRY-B/0.5/绿白",
                "partNumber": "FLRY-B/0.5/绿白",
                "partName": "0.5低压导线",
                "unit": "M",
                "quantity": 0.56,
                "rowNumbers": [
                  73
                ],
                "functions": [],
                "remarks": [
                  "福斯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01011780"
                ],
                "suppliers": [
                  "福斯"
                ],
                "sapNos": [
                  "A01011780"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            },
            {
              "itemKey": "FLRY-B/0.5/绿黑",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "FLRY-B/0.5/绿黑",
                "partNumber": "FLRY-B/0.5/绿黑",
                "partName": "0.5低压导线",
                "unit": "M",
                "quantity": 0.51,
                "rowNumbers": [
                  74
                ],
                "functions": [],
                "remarks": [
                  "福斯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01011786"
                ],
                "suppliers": [
                  "福斯"
                ],
                "sapNos": [
                  "A01011786"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            },
            {
              "itemKey": "FLRY-B/0.5/粉",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "FLRY-B/0.5/粉",
                "partNumber": "FLRY-B/0.5/粉",
                "partName": "0.5低压导线",
                "unit": "M",
                "quantity": 0.51,
                "rowNumbers": [
                  75
                ],
                "functions": [],
                "remarks": [
                  "福斯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01000221"
                ],
                "suppliers": [
                  "福斯"
                ],
                "sapNos": [
                  "A01000221"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            },
            {
              "itemKey": "FLRY-B/0.5/紫白",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "FLRY-B/0.5/紫白",
                "partNumber": "FLRY-B/0.5/紫白",
                "partName": "0.5低压导线",
                "unit": "M",
                "quantity": 0.51,
                "rowNumbers": [
                  76
                ],
                "functions": [],
                "remarks": [
                  "福斯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01011813"
                ],
                "suppliers": [
                  "福斯"
                ],
                "sapNos": [
                  "A01011813"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            }
          ]
        },
        {
          "key": "sync_brackets",
          "label": "支架类（同步开发件）",
          "section": "sync",
          "quoteCount": 6,
          "fixedCount": 5,
          "matchedCount": 4,
          "quoteOnlyCount": 2,
          "fixedOnlyCount": 1,
          "assemblyToPartsCount": 0,
          "assemblyPartCount": 0,
          "aligned": [
            {
              "itemKey": "G281-HB-01",
              "status": "quote_only",
              "quote": {
                "itemKey": "G281-HB-01",
                "partNumber": "G281-HB-01",
                "partName": "塑料护板上盖",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  32
                ],
                "functions": [],
                "remarks": [
                  "博昊/天久/华凯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "博昊/天久/华凯"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              },
              "fixed": null
            },
            {
              "itemKey": "G281-HB-02",
              "status": "quote_only",
              "quote": {
                "itemKey": "G281-HB-02",
                "partNumber": "G281-HB-02",
                "partName": "塑料护板下盖",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  33
                ],
                "functions": [],
                "remarks": [
                  "博昊/天久/华凯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "博昊/天久/华凯"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              },
              "fixed": null
            },
            {
              "itemKey": "G281-ZJ-01",
              "status": "matched",
              "quote": {
                "itemKey": "G281-ZJ-01",
                "partNumber": "G281-ZJ-01",
                "partName": "金属支架",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  34
                ],
                "functions": [],
                "remarks": [
                  "恒伟林/贵龙/华凯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "恒伟林/贵龙/华凯"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              },
              "fixed": {
                "itemKey": "G281-ZJ-01",
                "partNumber": "G281-ZJ-01",
                "partName": "金属支架",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  84
                ],
                "functions": [],
                "remarks": [
                  "贵龙"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06102152"
                ],
                "suppliers": [
                  "贵龙"
                ],
                "sapNos": [
                  "A06102152"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              }
            },
            {
              "itemKey": "G281-ZJ-02",
              "status": "matched",
              "quote": {
                "itemKey": "G281-ZJ-02",
                "partNumber": "G281-ZJ-02",
                "partName": "金属支架",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  35
                ],
                "functions": [],
                "remarks": [
                  "恒伟林/贵龙/华凯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "恒伟林/贵龙/华凯"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              },
              "fixed": {
                "itemKey": "G281-ZJ-02",
                "partNumber": "G281-ZJ-02",
                "partName": "金属支架",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  85
                ],
                "functions": [],
                "remarks": [
                  "贵龙"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06102151"
                ],
                "suppliers": [
                  "贵龙"
                ],
                "sapNos": [
                  "A06102151"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              }
            },
            {
              "itemKey": "G281-ZJ-03",
              "status": "matched",
              "quote": {
                "itemKey": "G281-ZJ-03",
                "partNumber": "G281-ZJ-03",
                "partName": "金属支架",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  36
                ],
                "functions": [],
                "remarks": [
                  "恒伟林/贵龙/华凯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "恒伟林/贵龙/华凯"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              },
              "fixed": {
                "itemKey": "G281-ZJ-03",
                "partNumber": "G281-ZJ-03",
                "partName": "金属支架",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  86
                ],
                "functions": [],
                "remarks": [
                  "贵龙"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06102150"
                ],
                "suppliers": [
                  "贵龙"
                ],
                "sapNos": [
                  "A06102150"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              }
            },
            {
              "itemKey": "G281-ZJ-04",
              "status": "matched",
              "quote": {
                "itemKey": "G281-ZJ-04",
                "partNumber": "G281-ZJ-04",
                "partName": "金属支架",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  37
                ],
                "functions": [],
                "remarks": [
                  "恒伟林/贵龙/华凯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "恒伟林/贵龙/华凯"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              },
              "fixed": {
                "itemKey": "G281-ZJ-04",
                "partNumber": "G281-ZJ-04",
                "partName": "金属支架",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  87
                ],
                "functions": [],
                "remarks": [
                  "华凯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06102149"
                ],
                "suppliers": [
                  "华凯"
                ],
                "sapNos": [
                  "A06102149"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              }
            },
            {
              "itemKey": "G281-HB-07",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "G281-HB-07",
                "partNumber": "G281-HB-07",
                "partName": "塑料护板",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  83
                ],
                "functions": [],
                "remarks": [
                  "上海程达"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06102153"
                ],
                "suppliers": [
                  "上海程达"
                ],
                "sapNos": [
                  "A06102153"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              }
            }
          ]
        },
        {
          "key": "sync_rubber",
          "label": "橡胶件类（同步开发件）",
          "section": "sync",
          "quoteCount": 4,
          "fixedCount": 5,
          "matchedCount": 4,
          "quoteOnlyCount": 0,
          "fixedOnlyCount": 1,
          "assemblyToPartsCount": 0,
          "assemblyPartCount": 0,
          "aligned": [
            {
              "itemKey": "G281-XJ-01",
              "status": "matched",
              "quote": {
                "itemKey": "G281-XJ-01",
                "partNumber": "G281-XJ-01",
                "partName": "橡胶件",
                "unit": "PCS",
                "quantity": 3,
                "rowNumbers": [
                  38
                ],
                "functions": [],
                "remarks": [
                  "恒伟林/远信/博昊/天乐"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "恒伟林/远信/博昊/天乐"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_rubber"
              },
              "fixed": {
                "itemKey": "G281-XJ-01",
                "partNumber": "G281-XJ-01",
                "partName": "橡胶件",
                "unit": "PCS",
                "quantity": 3,
                "rowNumbers": [
                  88
                ],
                "functions": [],
                "remarks": [
                  "博昊"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "博昊"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_rubber"
              }
            },
            {
              "itemKey": "G281-XJ-02",
              "status": "matched",
              "quote": {
                "itemKey": "G281-XJ-02",
                "partNumber": "G281-XJ-02",
                "partName": "橡胶件",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  39
                ],
                "functions": [],
                "remarks": [
                  "恒伟林/远信/博昊/天乐"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "恒伟林/远信/博昊/天乐"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_rubber"
              },
              "fixed": {
                "itemKey": "G281-XJ-02",
                "partNumber": "G281-XJ-02",
                "partName": "橡胶件",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  89
                ],
                "functions": [],
                "remarks": [
                  "博昊"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "博昊"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_rubber"
              }
            },
            {
              "itemKey": "G281-XJ-03",
              "status": "matched",
              "quote": {
                "itemKey": "G281-XJ-03",
                "partNumber": "G281-XJ-03",
                "partName": "橡胶件",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  40
                ],
                "functions": [],
                "remarks": [
                  "恒伟林/远信/博昊/天乐"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "恒伟林/远信/博昊/天乐"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_rubber"
              },
              "fixed": {
                "itemKey": "G281-XJ-03",
                "partNumber": "G281-XJ-03",
                "partName": "橡胶件",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  90
                ],
                "functions": [],
                "remarks": [
                  "博昊"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "博昊"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_rubber"
              }
            },
            {
              "itemKey": "G281-XJ-04",
              "status": "matched",
              "quote": {
                "itemKey": "G281-XJ-04",
                "partNumber": "G281-XJ-04",
                "partName": "橡胶件",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  41
                ],
                "functions": [],
                "remarks": [
                  "恒伟林/远信/博昊/天乐"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "恒伟林/远信/博昊/天乐"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_rubber"
              },
              "fixed": {
                "itemKey": "G281-XJ-04",
                "partNumber": "G281-XJ-04",
                "partName": "橡胶件",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  91
                ],
                "functions": [],
                "remarks": [
                  "博昊"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "博昊"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_rubber"
              }
            },
            {
              "itemKey": "G281-XJ-09",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "G281-XJ-09",
                "partNumber": "G281-XJ-09",
                "partName": "橡胶件",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  92
                ],
                "functions": [
                  "原G281-XJ-11"
                ],
                "remarks": [
                  "博昊"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "博昊"
                ],
                "sapNos": [],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_rubber"
              }
            }
          ]
        },
        {
          "key": "materials",
          "label": "其他物料",
          "section": "material",
          "quoteCount": 20,
          "fixedCount": 25,
          "matchedCount": 11,
          "quoteOnlyCount": 9,
          "fixedOnlyCount": 14,
          "assemblyToPartsCount": 0,
          "assemblyPartCount": 0,
          "aligned": [
            {
              "itemKey": "2377665-4",
              "status": "quote_only",
              "quote": {
                "itemKey": "2377665-4",
                "partNumber": "2377665-4",
                "partName": "防水栓",
                "unit": "PCS",
                "quantity": 18,
                "rowNumbers": [
                  10
                ],
                "functions": [],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A03033097"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "A03033097"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": null
            },
            {
              "itemKey": "963143-1",
              "status": "quote_only",
              "quote": {
                "itemKey": "963143-1",
                "partNumber": "963143-1",
                "partName": "盲栓（1/8/15/22）",
                "unit": "PCS",
                "quantity": 4,
                "rowNumbers": [
                  11
                ],
                "functions": [],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02031363"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "A02031363"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": null
            },
            {
              "itemKey": "BH4309802",
              "status": "matched",
              "quote": {
                "itemKey": "BH4309802",
                "partNumber": "BH4309802",
                "partName": "箭头扎带卡花",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  12
                ],
                "functions": [],
                "remarks": [
                  "博昊"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A06100441"
                ],
                "suppliers": [
                  "博昊"
                ],
                "sapNos": [
                  "A06100441"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "BH4309802",
                "partNumber": "BH4309802",
                "partName": "箭头扎带卡花",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  40
                ],
                "functions": [],
                "remarks": [
                  "博昊"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A06100441"
                ],
                "suppliers": [
                  "博昊"
                ],
                "sapNos": [
                  "A06100441"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "10800507250",
              "status": "quote_only",
              "quote": {
                "itemKey": "10800507250",
                "partNumber": "10800507250",
                "partName": "防水栓",
                "unit": "PCS",
                "quantity": 4,
                "rowNumbers": [
                  17
                ],
                "functions": [],
                "remarks": [
                  "赫尔斯曼"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A03011408"
                ],
                "suppliers": [
                  "赫尔斯曼"
                ],
                "sapNos": [
                  "A03011408"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": null
            },
            {
              "itemKey": "10106880",
              "status": "quote_only",
              "quote": {
                "itemKey": "10106880",
                "partNumber": "10106880",
                "partName": "接地热缩管",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  20
                ],
                "functions": [],
                "remarks": [
                  "深圳宏商/长春海达"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04032364"
                ],
                "suppliers": [
                  "深圳宏商/长春海达"
                ],
                "sapNos": [
                  "A04032364"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": null
            },
            {
              "itemKey": "LG3305D012B",
              "status": "quote_only",
              "quote": {
                "itemKey": "LG3305D012B",
                "partNumber": "LG3305D012B",
                "partName": "12OR橙色波纹管",
                "unit": "M",
                "quantity": 1.2,
                "rowNumbers": [
                  26
                ],
                "functions": [],
                "remarks": [
                  "骏鼎达/诗兰姆"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101161"
                ],
                "suppliers": [
                  "骏鼎达/诗兰姆"
                ],
                "sapNos": [
                  "A04101161"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": null
            },
            {
              "itemKey": "SCS2165A019",
              "status": "matched",
              "quote": {
                "itemKey": "SCS2165A019",
                "partNumber": "SCS2165A019",
                "partName": "19OR橙色编织套管",
                "unit": "M",
                "quantity": 1.9,
                "rowNumbers": [
                  27
                ],
                "functions": [],
                "remarks": [
                  "骏鼎达/明鑫"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101671"
                ],
                "suppliers": [
                  "骏鼎达/明鑫"
                ],
                "sapNos": [
                  "A04101671"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "SCS2165A019",
                "partNumber": "SCS2165A019",
                "partName": "19OR橙色编织套管",
                "unit": "M",
                "quantity": 1.9,
                "rowNumbers": [
                  78
                ],
                "functions": [],
                "remarks": [
                  "骏鼎达"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101671"
                ],
                "suppliers": [
                  "骏鼎达"
                ],
                "sapNos": [
                  "A04101671"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "LY5016019-OR2",
              "status": "matched",
              "quote": {
                "itemKey": "LY5016019-OR2",
                "partNumber": "LY5016019-OR2",
                "partName": "橙色布基胶带",
                "unit": "M",
                "quantity": 5,
                "rowNumbers": [
                  28
                ],
                "functions": [],
                "remarks": [
                  "联益"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101159"
                ],
                "suppliers": [
                  "联益"
                ],
                "sapNos": [
                  "A04101159"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "LY5016019-OR2",
                "partNumber": "LY5016019-OR2",
                "partName": "橙色布基胶带",
                "unit": "M",
                "quantity": 5,
                "rowNumbers": [
                  79
                ],
                "functions": [],
                "remarks": [
                  "联益"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101159"
                ],
                "suppliers": [
                  "联益"
                ],
                "sapNos": [
                  "A04101159"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "LY5016019",
              "status": "matched",
              "quote": {
                "itemKey": "LY5016019",
                "partNumber": "LY5016019",
                "partName": "黑色布基胶带",
                "unit": "M",
                "quantity": 1.66,
                "rowNumbers": [
                  29
                ],
                "functions": [],
                "remarks": [
                  "联益"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04030943"
                ],
                "suppliers": [
                  "联益"
                ],
                "sapNos": [
                  "A04030943"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "LY5016019",
                "partNumber": "LY5016019",
                "partName": "黑色布基胶带",
                "unit": "M",
                "quantity": 1.66,
                "rowNumbers": [
                  80
                ],
                "functions": [],
                "remarks": [
                  "联益"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04030943"
                ],
                "suppliers": [
                  "联益"
                ],
                "sapNos": [
                  "A04030943"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "P111W0192510002",
              "status": "quote_only",
              "quote": {
                "itemKey": "P111W0192510002",
                "partNumber": "P111W0192510002",
                "partName": "橙色PVC胶带",
                "unit": "M",
                "quantity": 4.5,
                "rowNumbers": [
                  30
                ],
                "functions": [],
                "remarks": [
                  "亚化"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101670"
                ],
                "suppliers": [
                  "亚化"
                ],
                "sapNos": [
                  "A04101670"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": null
            },
            {
              "itemKey": "6211015110AL",
              "status": "matched",
              "quote": {
                "itemKey": "6211015110AL",
                "partNumber": "6211015110AL",
                "partName": "防水泥",
                "unit": "PCS",
                "quantity": 3,
                "rowNumbers": [
                  31
                ],
                "functions": [],
                "remarks": [
                  "DSG/凯密科"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04010396"
                ],
                "suppliers": [
                  "DSG/凯密科"
                ],
                "sapNos": [
                  "A04010396"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "6211015110AL",
                "partNumber": "6211015110AL",
                "partName": "防水泥",
                "unit": "PCS",
                "quantity": 3,
                "rowNumbers": [
                  82
                ],
                "functions": [],
                "remarks": [
                  "DSG"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04010396"
                ],
                "suppliers": [
                  "DSG"
                ],
                "sapNos": [
                  "A04010396"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "PP9104320",
              "status": "matched",
              "quote": {
                "itemKey": "PP9104320",
                "partNumber": "PP9104320",
                "partName": "7*12箭头扎带",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  42
                ],
                "functions": [],
                "remarks": [
                  "上海众安/海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06101606"
                ],
                "suppliers": [
                  "上海众安/海尔曼太通"
                ],
                "sapNos": [
                  "A06101606"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "PP9104320",
                "partNumber": "PP9104320",
                "partName": "7*12箭头扎带",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  93
                ],
                "functions": [],
                "remarks": [
                  "上海众安"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06101606"
                ],
                "suppliers": [
                  "上海众安"
                ],
                "sapNos": [
                  "A06101606"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "PP9108401",
              "status": "quote_only",
              "quote": {
                "itemKey": "PP9108401",
                "partNumber": "PP9108401",
                "partName": "M8箭头卡扣",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  43
                ],
                "functions": [],
                "remarks": [
                  "上海众安/海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "上海众安/海尔曼太通"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": null
            },
            {
              "itemKey": "PP9122201",
              "status": "matched",
              "quote": {
                "itemKey": "PP9122201",
                "partNumber": "PP9122201",
                "partName": "M6竖置螺柱卡",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  44
                ],
                "functions": [],
                "remarks": [
                  "上海众安/海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06101666"
                ],
                "suppliers": [
                  "上海众安/海尔曼太通"
                ],
                "sapNos": [
                  "A06101666"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "PP9122201",
                "partNumber": "PP9122201",
                "partName": "M6立置螺柱卡",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  95
                ],
                "functions": [],
                "remarks": [
                  "上海众安"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06101666"
                ],
                "suppliers": [
                  "上海众安"
                ],
                "sapNos": [
                  "A06101666"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "PP9123801",
              "status": "quote_only",
              "quote": {
                "itemKey": "PP9123801",
                "partNumber": "PP9123801",
                "partName": "M5螺柱卡扣",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  45
                ],
                "functions": [],
                "remarks": [
                  "上海众安/海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "上海众安/海尔曼太通"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": null
            },
            {
              "itemKey": "PP9117701",
              "status": "matched",
              "quote": {
                "itemKey": "PP9117701",
                "partNumber": "PP9117701",
                "partName": "M6杉树卡扣",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  46
                ],
                "functions": [],
                "remarks": [
                  "上海众安/海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06004922"
                ],
                "suppliers": [
                  "上海众安/海尔曼太通"
                ],
                "sapNos": [
                  "A06004922"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "PP9117701",
                "partNumber": "PP9117701",
                "partName": "M6杉树卡扣",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  97
                ],
                "functions": [],
                "remarks": [
                  "上海众安"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06004922"
                ],
                "suppliers": [
                  "上海众安"
                ],
                "sapNos": [
                  "A06004922"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "PP9220301",
              "status": "matched",
              "quote": {
                "itemKey": "PP9220301",
                "partNumber": "PP9220301",
                "partName": "7*12箭头一字卡",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  47
                ],
                "functions": [],
                "remarks": [
                  "上海众安/海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06004079"
                ],
                "suppliers": [
                  "上海众安/海尔曼太通"
                ],
                "sapNos": [
                  "A06004079"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "PP9220301",
                "partNumber": "PP9220301",
                "partName": "7*12箭头一字卡",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  98
                ],
                "functions": [],
                "remarks": [
                  "上海众安"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06004079"
                ],
                "suppliers": [
                  "上海众安"
                ],
                "sapNos": [
                  "A06004079"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "111-00563",
              "status": "matched",
              "quote": {
                "itemKey": "111-00563",
                "partNumber": "111-00563",
                "partName": "扎带绳",
                "unit": "PCS",
                "quantity": 7,
                "rowNumbers": [
                  48
                ],
                "functions": [],
                "remarks": [
                  "上海众安/海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06010012"
                ],
                "suppliers": [
                  "上海众安/海尔曼太通"
                ],
                "sapNos": [
                  "A06010012"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "111-00563",
                "partNumber": "111-00563",
                "partName": "扎带绳",
                "unit": "PCS",
                "quantity": 5,
                "rowNumbers": [
                  99
                ],
                "functions": [],
                "remarks": [
                  "海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06010012"
                ],
                "suppliers": [
                  "海尔曼太通"
                ],
                "sapNos": [
                  "A06010012"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "108-00150",
              "status": "quote_only",
              "quote": {
                "itemKey": "108-00150",
                "partNumber": "108-00150",
                "partName": "扎带绳",
                "unit": "PCS",
                "quantity": 3,
                "rowNumbers": [
                  49
                ],
                "functions": [],
                "remarks": [
                  "上海众安/海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06100602"
                ],
                "suppliers": [
                  "上海众安/海尔曼太通"
                ],
                "sapNos": [
                  "A06100602"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": null
            },
            {
              "itemKey": "X1-BQ-01标签140X30MM",
              "status": "matched",
              "quote": {
                "itemKey": "X1-BQ-01标签140X30MM",
                "partNumber": "X1-BQ-01 标签140x30mm",
                "partName": "产品标签",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  50
                ],
                "functions": [],
                "remarks": [
                  "洪众"
                ],
                "otherRemarks": [],
                "wireNos": [
                  "70002326"
                ],
                "suppliers": [
                  "洪众"
                ],
                "sapNos": [
                  "70002326"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "X1-BQ-01标签140X30MM",
                "partNumber": "X1-BQ-01 标签140x30mm",
                "partName": "产品标签",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  102
                ],
                "functions": [],
                "remarks": [
                  "洪众"
                ],
                "otherRemarks": [],
                "wireNos": [
                  "70002326"
                ],
                "suppliers": [
                  "洪众"
                ],
                "sapNos": [
                  "70002326"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "2490531-6",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "2490531-6",
                "partNumber": "2490531-6",
                "partName": "法兰盘面板",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  6
                ],
                "functions": [],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A05100638"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "A05100638"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "2333692-1",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "2333692-1",
                "partNumber": "2333692-1",
                "partName": "M3.5螺栓",
                "unit": "PCS",
                "quantity": 6,
                "rowNumbers": [
                  21
                ],
                "functions": [],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A07003208"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "A07003208"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "2333693-1",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "2333693-1",
                "partNumber": "2333693-1",
                "partName": "M5螺栓",
                "unit": "PCS",
                "quantity": 4,
                "rowNumbers": [
                  22
                ],
                "functions": [],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A07003209"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "A07003209"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "5-2435306-1",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "5-2435306-1",
                "partNumber": "5-2435306-1",
                "partName": "盲堵",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  29
                ],
                "functions": [],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02101106"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "A02101106"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "HVSPC2P1900FF-09120",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "HVSPC2P1900FF-09120",
                "partNumber": "HVSPC2P1900FF-09120",
                "partName": "120mm²线夹",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  45
                ],
                "functions": [],
                "remarks": [
                  "安费诺"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02105130"
                ],
                "suppliers": [
                  "安费诺"
                ],
                "sapNos": [
                  "A02105130"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "HVSPC2P1900FF-07120",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "HVSPC2P1900FF-07120",
                "partNumber": "HVSPC2P1900FF-07120",
                "partName": "120mm²后盖",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  46
                ],
                "functions": [],
                "remarks": [
                  "安费诺"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02105125"
                ],
                "suppliers": [
                  "安费诺"
                ],
                "sapNos": [
                  "A02105125"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "HDGW12-30",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "HDGW12-30",
                "partNumber": "HDGW 12-30",
                "partName": "带胶-热缩管-黑色",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  54
                ],
                "functions": [
                  "AC-PE和DC-PE热缩管"
                ],
                "remarks": [
                  "长春海达"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04102221"
                ],
                "suppliers": [
                  "长春海达"
                ],
                "sapNos": [
                  "A04102221"
                ],
                "assemblyRefs": [
                  "AC-PE和DC-PE热缩管"
                ],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "HS-125(3X)9-30耐温125℃，内径8长度验证，申请样品验证后建号",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "HS-125(3X)9-30耐温125℃，内径8长度验证，申请样品验证后建号",
                "partNumber": "HS-125(3X) 9-30 耐温125℃，内径8长度验证，申请样品验证后建号",
                "partName": "不带胶-热缩管黑色",
                "unit": "PCS",
                "quantity": 4,
                "rowNumbers": [
                  55
                ],
                "functions": [
                  "L1/N/AC-PE/DC-PE使用热缩管"
                ],
                "remarks": [
                  "长春海达"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "长春海达"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [
                  "L1/N/AC-PE/DC-PE使用热缩管"
                ],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "LG3305R010B",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "LG3305R010B",
                "partNumber": "LG3305R010B",
                "partName": "10OR橙色波纹管",
                "unit": "M",
                "quantity": 1.2,
                "rowNumbers": [
                  77
                ],
                "functions": [],
                "remarks": [
                  "骏鼎达"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04102623"
                ],
                "suppliers": [
                  "骏鼎达"
                ],
                "sapNos": [
                  "A04102623"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "P111W0192510003",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "P111W0192510003",
                "partNumber": "P111W0192510003",
                "partName": "橙色PVC胶带",
                "unit": "M",
                "quantity": 4.5,
                "rowNumbers": [
                  81
                ],
                "functions": [],
                "remarks": [
                  "亚化"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101791"
                ],
                "suppliers": [
                  "亚化"
                ],
                "sapNos": [
                  "A04101791"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "126-00177",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "126-00177",
                "partNumber": "126-00177",
                "partName": "M6.5箭头卡扣",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  94
                ],
                "functions": [],
                "remarks": [
                  "海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06004365"
                ],
                "suppliers": [
                  "海尔曼太通"
                ],
                "sapNos": [
                  "A06004365"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "PP9120801",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "PP9120801",
                "partNumber": "PP9120801",
                "partName": "M6侧置螺柱卡",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  96
                ],
                "functions": [],
                "remarks": [
                  "上海众安"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06004924"
                ],
                "suppliers": [
                  "上海众安"
                ],
                "sapNos": [
                  "A06004924"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "111-00580",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "111-00580",
                "partNumber": "111-00580",
                "partName": "扎带绳",
                "unit": "PCS",
                "quantity": 4,
                "rowNumbers": [
                  100
                ],
                "functions": [],
                "remarks": [
                  "海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06000221"
                ],
                "suppliers": [
                  "海尔曼太通"
                ],
                "sapNos": [
                  "A06000221"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "PP9127401",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "PP9127401",
                "partNumber": "PP9127401",
                "partName": "隔线扎带绳",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  101
                ],
                "functions": [],
                "remarks": [
                  "上海众安"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06101064"
                ],
                "suppliers": [
                  "上海众安"
                ],
                "sapNos": [
                  "A06101064"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            }
          ]
        }
      ]
    },
    "6608442966": {
      "harnessId": "6608442966",
      "harnessName": "组合式充电插座线束总成",
      "quoteSheet": "6608442966",
      "fixedSheet": "6608442966",
      "sources": {
        "quote": {
          "sheet": "6608442966",
          "itemCount": 46
        },
        "fixed": {
          "sheet": "6608442966",
          "itemCount": 98
        }
      },
      "summary": {
        "groupCount": 11,
        "connectorGroupCount": 7,
        "syncGroupCount": 2,
        "quoteItemCount": 46,
        "fixedItemCount": 95,
        "matchedCount": 26,
        "quoteOnlyCount": 15,
        "fixedOnlyCount": 39,
        "assemblyToPartsCount": 5,
        "assemblyPartCount": 30,
        "wireMatchedCount": 4,
        "syncMatchedCount": 8,
        "materialMatchedCount": 19
      },
      "groups": [
        {
          "key": "charge_socket",
          "label": "充电插座",
          "section": "connector",
          "quoteCount": 1,
          "fixedCount": 15,
          "matchedCount": 0,
          "quoteOnlyCount": 0,
          "fixedOnlyCount": 0,
          "assemblyToPartsCount": 1,
          "assemblyPartCount": 15,
          "aligned": [
            {
              "itemKey": "2523328-1",
              "status": "assembly_to_parts",
              "mappingType": "assembly_to_parts",
              "quote": {
                "itemKey": "2523328-1",
                "partNumber": "2523328-1",
                "partName": "组合式充电插座(带防尘盖)",
                "unit": "SET",
                "quantity": 1,
                "rowNumbers": [
                  5
                ],
                "functions": [
                  "组合式充电插座(带电子锁，防尘盖)"
                ],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [
                  "2523328-1"
                ],
                "kind": "connector",
                "groupKey": "charge_socket"
              },
              "fixed": null,
              "fixedParts": [
                {
                  "itemKey": "2519063-1",
                  "partNumber": "2519063-1",
                  "partName": "防尘盖组件",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    5
                  ],
                  "functions": [
                    "组合式充电插座(带电子锁，防尘盖)"
                  ],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105132"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A02105132"
                  ],
                  "assemblyRefs": [
                    "2523328-1 组合式充电插座(带电子锁，防尘盖) DC：120mm²非屏蔽硅胶铝导线 AC：6mm²非屏蔽铝导线 DC接地：6mm²非屏蔽黄绿铜导线 AC接地：5mm²非屏蔽黄绿铜导线"
                  ],
                  "kind": "connector",
                  "groupKey": "charge_socket"
                },
                {
                  "itemKey": "2521766-1",
                  "partNumber": "2521766-1",
                  "partName": "直流壳体组件",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    7
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A05100637"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A05100637"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "charge_socket"
                },
                {
                  "itemKey": "2495482-6",
                  "partNumber": "2495482-6",
                  "partName": "DC-焊接端子组件",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    8
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03103436"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A03103436"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "charge_socket"
                },
                {
                  "itemKey": "2521057-1",
                  "partNumber": "2521057-1",
                  "partName": "DC-PE-压接端子",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    9
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A05100556"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A05100556"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "charge_socket"
                },
                {
                  "itemKey": "2411162-9",
                  "partNumber": "2411162-9",
                  "partName": "密封圈-DC-焊接端子",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    10
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02104529"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A02104529"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "charge_socket"
                },
                {
                  "itemKey": "2403723-6",
                  "partNumber": "2403723-6",
                  "partName": "PE线密封圈",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    11
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02104531"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A02104531"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "charge_socket"
                },
                {
                  "itemKey": "2403722-7",
                  "partNumber": "2403722-7",
                  "partName": "PE尾盖",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    12
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02104533"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A02104533"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "charge_socket"
                },
                {
                  "itemKey": "2406408-1",
                  "partNumber": "2406408-1",
                  "partName": "DC线密封圈",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    13
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105133"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A02105133"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "charge_socket"
                },
                {
                  "itemKey": "2406406-1",
                  "partNumber": "2406406-1",
                  "partName": "DC尾盖",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    14
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105131"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A02105131"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "charge_socket"
                },
                {
                  "itemKey": "2517495-1",
                  "partNumber": "2517495-1",
                  "partName": "交流壳体组件",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    15
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A05100636"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A05100636"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "charge_socket"
                },
                {
                  "itemKey": "2519345-1",
                  "partNumber": "2519345-1",
                  "partName": "AC+AC-PE焊接端子",
                  "unit": "PCS",
                  "quantity": 3,
                  "rowNumbers": [
                    16
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03103175"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A03103175"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "charge_socket"
                },
                {
                  "itemKey": "2500438-1",
                  "partNumber": "2500438-1",
                  "partName": "密封圈-AC+AC-PE焊接端子",
                  "unit": "PCS",
                  "quantity": 3,
                  "rowNumbers": [
                    17
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02104528"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A02104528"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "charge_socket"
                },
                {
                  "itemKey": "2499861-1",
                  "partNumber": "2499861-1",
                  "partName": "AC+PE尾盖",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    18
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A05100560"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A05100560"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "charge_socket"
                },
                {
                  "itemKey": "2483376-2",
                  "partNumber": "2483376-2",
                  "partName": "电子锁",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    19
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A05100635"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A05100635"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "charge_socket"
                },
                {
                  "itemKey": "2518993-4",
                  "partNumber": "2518993-4",
                  "partName": "电子锁拉绳",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    20
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A05100634"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A05100634"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "charge_socket"
                }
              ]
            }
          ]
        },
        {
          "key": "dc_charge_end",
          "label": "快充端",
          "section": "connector",
          "quoteCount": 2,
          "fixedCount": 7,
          "matchedCount": 1,
          "quoteOnlyCount": 0,
          "fixedOnlyCount": 0,
          "assemblyToPartsCount": 1,
          "assemblyPartCount": 6,
          "aligned": [
            {
              "itemKey": "1-2438787-1",
              "status": "matched",
              "quote": {
                "itemKey": "1-2438787-1",
                "partNumber": "1-2438787-1",
                "partName": "低压连接器总成（10PIN，10个端子，10个防水栓）",
                "unit": "SET",
                "quantity": 1,
                "rowNumbers": [
                  7
                ],
                "functions": [
                  "DC 10PIN低压信号连接器"
                ],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [
                  "1-2438787-1"
                ],
                "kind": "connector",
                "groupKey": "dc_charge_end"
              },
              "fixed": {
                "itemKey": "1-2438787-1",
                "partNumber": "1-2438787-1",
                "partName": "DC端低压插件-8pin",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  23
                ],
                "functions": [
                  "DC 8PIN低压信号连接器"
                ],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02100365"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "A02100365"
                ],
                "assemblyRefs": [
                  "1-2438787-1 DC 8PIN低压信号连接器 适配8*0.5mm²线"
                ],
                "kind": "connector",
                "groupKey": "dc_charge_end"
              }
            },
            {
              "itemKey": "HVSPC2P1900FS112",
              "status": "assembly_to_parts",
              "mappingType": "assembly_to_parts",
              "quote": {
                "itemKey": "HVSPC2P1900FS112",
                "partNumber": "HVSPC2P1900FS112",
                "partName": "ODP端连接器（直流）",
                "unit": "SET",
                "quantity": 1,
                "rowNumbers": [
                  13
                ],
                "functions": [
                  "快充连接器（直流）"
                ],
                "remarks": [
                  "安费诺"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "安费诺"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [
                  "HVSPC2P1900FS112"
                ],
                "kind": "connector",
                "groupKey": "dc_charge_end"
              },
              "fixed": null,
              "fixedParts": [
                {
                  "itemKey": "7-2435189-1",
                  "partNumber": "7-2435189-1",
                  "partName": "低压线端子-链式压接",
                  "unit": "PCS",
                  "quantity": 13,
                  "rowNumbers": [
                    24,
                    27
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03033043"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A03033043"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "dc_charge_end"
                },
                {
                  "itemKey": "5-2435022-1",
                  "partNumber": "5-2435022-1",
                  "partName": "低压线防水栓",
                  "unit": "PCS",
                  "quantity": 17,
                  "rowNumbers": [
                    25,
                    28,
                    32
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03100681"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A03100681"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "dc_charge_end"
                },
                {
                  "itemKey": "HVSPC2P1900FS1-M",
                  "partNumber": "HVSPC2P1900FS1-M",
                  "partName": "护套-正插Code A0-180度",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    41
                  ],
                  "functions": [
                    "快充连接器（直流）"
                  ],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105129"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02105129"
                  ],
                  "assemblyRefs": [
                    "HVSPC2P1900FS112 快充连接器（直流） 适配2*120mm²非屏蔽硅胶铝导线 ESOW：HVSPC2P1900FS112（安费诺，120方非屏蔽、CodeA、带互锁、180°正插） 3D数据：Code A0 180度 安费诺提供资料：180度"
                  ],
                  "kind": "connector",
                  "groupKey": "dc_charge_end"
                },
                {
                  "itemKey": "HVPC2P1900FS-05",
                  "partNumber": "HVPC2P1900FS-05",
                  "partName": "端子",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    42
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03103435"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A03103435"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "dc_charge_end"
                },
                {
                  "itemKey": "HVPC2P1900FV-08",
                  "partNumber": "HVPC2P1900FV-08",
                  "partName": "密封圈挡板",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    43
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02104536"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02104536"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "dc_charge_end"
                },
                {
                  "itemKey": "HVPC2P1900FV-0985",
                  "partNumber": "HVPC2P1900FV-0985",
                  "partName": "120mm²密封圈",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    44
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105127"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02105127"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "dc_charge_end"
                }
              ]
            }
          ]
        },
        {
          "key": "ac_charge_end",
          "label": "慢充端",
          "section": "connector",
          "quoteCount": 2,
          "fixedCount": 6,
          "matchedCount": 0,
          "quoteOnlyCount": 0,
          "fixedOnlyCount": 0,
          "assemblyToPartsCount": 2,
          "assemblyPartCount": 6,
          "aligned": [
            {
              "itemKey": "1-2355517-1",
              "status": "assembly_to_parts",
              "mappingType": "assembly_to_parts",
              "quote": {
                "itemKey": "1-2355517-1",
                "partNumber": "1-2355517-1",
                "partName": "低压连接器总成（5PIN，5个端子，5个防水栓）",
                "unit": "SET",
                "quantity": 1,
                "rowNumbers": [
                  6
                ],
                "functions": [
                  "AC 5PIN低压信号连接器"
                ],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [
                  "1-2355517-1"
                ],
                "kind": "connector",
                "groupKey": "ac_charge_end"
              },
              "fixed": null,
              "fixedParts": [
                {
                  "itemKey": "1-2355517-5",
                  "partNumber": "1-2355517-5",
                  "partName": "AC端低压插件-5pin",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    26
                  ],
                  "functions": [
                    "AC 6PIN低压信号连接器,"
                  ],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02034551"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A02034551"
                  ],
                  "assemblyRefs": [
                    "1-2355517-5 AC 6PIN低压信号连接器, 6#不使用 适配5*0.5方单芯铜导线"
                  ],
                  "kind": "connector",
                  "groupKey": "ac_charge_end"
                }
              ]
            },
            {
              "itemKey": "HVC2PG263UFSW106-NH",
              "status": "assembly_to_parts",
              "mappingType": "assembly_to_parts",
              "quote": {
                "itemKey": "HVC2PG263UFSW106-NH",
                "partNumber": "HVC2PG263UFSW106-NH",
                "partName": "ODP端连接器（交流）",
                "unit": "SET",
                "quantity": 1,
                "rowNumbers": [
                  14
                ],
                "functions": [
                  "慢充连接器（交流）"
                ],
                "remarks": [
                  "安费诺"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "安费诺"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [
                  "HVC2PG263UFSW106-NH"
                ],
                "kind": "connector",
                "groupKey": "ac_charge_end"
              },
              "fixed": null,
              "fixedParts": [
                {
                  "itemKey": "HVC2PG263FSW1-M-NH-P010",
                  "partNumber": "HVC2PG263FSW1-M-NH-P010",
                  "partName": "插头组件Code A 无高压互锁",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    47
                  ],
                  "functions": [
                    "慢充连接器（交流）"
                  ],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02104803"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02104803"
                  ],
                  "assemblyRefs": [
                    "HVC2PG263UFSW106-NH 慢充连接器（交流） 适配2*6mm²非屏蔽铝导线 （安费诺，取消互锁，工具解锁，6方非屏蔽铝线，超声波焊接）"
                  ],
                  "kind": "connector",
                  "groupKey": "ac_charge_end"
                },
                {
                  "itemKey": "N022525343C-P010",
                  "partNumber": "N022525343C-P010",
                  "partName": "6.3母端子(2.5-6mm²)",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    48
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03101971"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A03101971"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "ac_charge_end"
                },
                {
                  "itemKey": "HVC2P63FS-10-0902-P010",
                  "partNumber": "HVC2P63FS-10-0902-P010",
                  "partName": "HVC2P63-02线束密封圈 白色",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    49
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105128"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02105128"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "ac_charge_end"
                },
                {
                  "itemKey": "HVC2P63UFS-21-0306-P010",
                  "partNumber": "HVC2P63UFS-21-0306-P010",
                  "partName": "HVC2P63插头06非屏蔽线卡 紫色",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    50
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105123"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02105123"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "ac_charge_end"
                },
                {
                  "itemKey": "HVC2P63UFS-22-0306-P010",
                  "partNumber": "HVC2P63UFS-22-0306-P010",
                  "partName": "HVC2P63插头06非屏蔽后盖 紫色",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    51
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105126"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02105126"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "ac_charge_end"
                }
              ]
            }
          ]
        },
        {
          "key": "electronic_lock",
          "label": "电子锁",
          "section": "connector",
          "quoteCount": 2,
          "fixedCount": 3,
          "matchedCount": 0,
          "quoteOnlyCount": 1,
          "fixedOnlyCount": 0,
          "assemblyToPartsCount": 1,
          "assemblyPartCount": 3,
          "aligned": [
            {
              "itemKey": "805-122-541",
              "status": "assembly_to_parts",
              "mappingType": "assembly_to_parts",
              "quote": {
                "itemKey": "805-122-541",
                "partNumber": "805-122-541",
                "partName": "护套",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  15
                ],
                "functions": [
                  "电子锁低压连接器总成"
                ],
                "remarks": [
                  "赫尔斯曼"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02000642"
                ],
                "suppliers": [
                  "赫尔斯曼"
                ],
                "sapNos": [
                  "A02000642"
                ],
                "assemblyRefs": [
                  "805-122-541"
                ],
                "kind": "connector",
                "groupKey": "electronic_lock"
              },
              "fixed": null,
              "fixedParts": [
                {
                  "itemKey": "2298159-1",
                  "partNumber": "2298159-1",
                  "partName": "电子锁低压插件-4pin",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    30
                  ],
                  "functions": [
                    "电子锁低压连接器总成"
                  ],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02033733"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A02033733"
                  ],
                  "assemblyRefs": [
                    "2298159-1 电子锁低压连接器总成 适配4*0.5mm²单芯铜导线"
                  ],
                  "kind": "connector",
                  "groupKey": "electronic_lock"
                },
                {
                  "itemKey": "5-965906-1",
                  "partNumber": "5-965906-1",
                  "partName": "电子锁低压端子-链式压接",
                  "unit": "PCS",
                  "quantity": 4,
                  "rowNumbers": [
                    31
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03030931"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A03030931"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "electronic_lock"
                },
                {
                  "itemKey": "10106502",
                  "partNumber": "10106502",
                  "partName": "带胶-热缩管",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    56
                  ],
                  "functions": [
                    "电子锁低压线并线焊接热缩"
                  ],
                  "remarks": [
                    "深圳宏商"
                  ],
                  "otherRemarks": [
                    "★"
                  ],
                  "wireNos": [
                    "A04032307"
                  ],
                  "suppliers": [
                    "深圳宏商"
                  ],
                  "sapNos": [
                    "A04032307"
                  ],
                  "assemblyRefs": [
                    "电子锁低压线并线焊接热缩"
                  ],
                  "kind": "connector",
                  "groupKey": "electronic_lock"
                }
              ]
            },
            {
              "itemKey": "32140734123",
              "status": "quote_only",
              "quote": {
                "itemKey": "32140734123",
                "partNumber": "32140734123",
                "partName": "端子",
                "unit": "PCS",
                "quantity": 4,
                "rowNumbers": [
                  16
                ],
                "functions": [],
                "remarks": [
                  "科世达"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A03032316"
                ],
                "suppliers": [
                  "科世达"
                ],
                "sapNos": [
                  "A03032316"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "electronic_lock"
              },
              "fixed": null
            }
          ]
        },
        {
          "key": "low_voltage_inline",
          "label": "低压连接器",
          "section": "connector",
          "quoteCount": 2,
          "fixedCount": 7,
          "matchedCount": 2,
          "quoteOnlyCount": 0,
          "fixedOnlyCount": 5,
          "assemblyToPartsCount": 0,
          "assemblyPartCount": 0,
          "aligned": [
            {
              "itemKey": "5-2385463-1",
              "status": "matched",
              "quote": {
                "itemKey": "5-2385463-1",
                "partNumber": "5-2385463-1",
                "partName": "护套塑壳",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  8
                ],
                "functions": [
                  "低压连接器总成"
                ],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02101947"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "A02101947"
                ],
                "assemblyRefs": [
                  "5-2385463-1"
                ],
                "kind": "connector",
                "groupKey": "low_voltage_inline"
              },
              "fixed": {
                "itemKey": "5-2385463-1",
                "partNumber": "5-2385463-1",
                "partName": "护套塑壳",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  33
                ],
                "functions": [
                  "低压inline连接器总成，22pin使用16pin"
                ],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02101947"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "A02101947"
                ],
                "assemblyRefs": [
                  "5-2385463-1 低压inline连接器总成，22pin使用16pin 4#8#13#15#16#22#不使用 适配16*0.5mm²单芯铜导线"
                ],
                "kind": "connector",
                "groupKey": "low_voltage_inline"
              }
            },
            {
              "itemKey": "2377023-2",
              "status": "matched",
              "quote": {
                "itemKey": "2377023-2",
                "partNumber": "2377023-2",
                "partName": "端子",
                "unit": "PCS",
                "quantity": 18,
                "rowNumbers": [
                  9
                ],
                "functions": [],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A03033091"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "A03033091"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "low_voltage_inline"
              },
              "fixed": {
                "itemKey": "2377023-2",
                "partNumber": "2377023-2",
                "partName": "0.64型端子",
                "unit": "PCS",
                "quantity": 15,
                "rowNumbers": [
                  34
                ],
                "functions": [],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A03033091"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "A03033091"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "low_voltage_inline"
              }
            },
            {
              "itemKey": "2377789-2",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "2377789-2",
                "partNumber": "2377789-2",
                "partName": "1.2型端子",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  35
                ],
                "functions": [],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A03033363"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "A03033363"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "low_voltage_inline"
              }
            },
            {
              "itemKey": "2377665-4",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "2377665-4",
                "partNumber": "2377665-4",
                "partName": "防水栓（非1/8/15/22）-0.64型端子使用",
                "unit": "PCS",
                "quantity": 15,
                "rowNumbers": [
                  36
                ],
                "functions": [],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A03033097"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "A03033097"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "low_voltage_inline"
              }
            },
            {
              "itemKey": "963142-1",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "963142-1",
                "partNumber": "963142-1",
                "partName": "防水栓（1/8/15/22）-1.2型端子使用",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  37
                ],
                "functions": [],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A03030849"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "A03030849"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "low_voltage_inline"
              }
            },
            {
              "itemKey": "2377665-3",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "2377665-3",
                "partNumber": "2377665-3",
                "partName": "盲栓（非1/8/15/22）-0.64型端子使用",
                "unit": "PCS",
                "quantity": 3,
                "rowNumbers": [
                  38
                ],
                "functions": [],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02034386"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "A02034386"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "low_voltage_inline"
              }
            },
            {
              "itemKey": "963143-1",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "963143-1",
                "partNumber": "963143-1",
                "partName": "盲栓（1/8/15/22）-1.2型端子使用",
                "unit": "PCS",
                "quantity": 3,
                "rowNumbers": [
                  39
                ],
                "functions": [],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02031363"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "A02031363"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "low_voltage_inline"
              }
            }
          ]
        },
        {
          "key": "dc_ground",
          "label": "DC 接地端子",
          "section": "connector",
          "quoteCount": 1,
          "fixedCount": 1,
          "matchedCount": 0,
          "quoteOnlyCount": 1,
          "fixedOnlyCount": 1,
          "assemblyToPartsCount": 0,
          "assemblyPartCount": 0,
          "aligned": [
            {
              "itemKey": "K03006773",
              "status": "quote_only",
              "quote": {
                "itemKey": "K03006773",
                "partNumber": "K03006773",
                "partName": "DC接地端子",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  18
                ],
                "functions": [
                  "DC接地端子"
                ],
                "remarks": [
                  "丰迪/荣盛达"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "丰迪/荣盛达"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "dc_ground"
              },
              "fixed": null
            },
            {
              "itemKey": "K03005541",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "K03005541",
                "partNumber": "K03005541",
                "partName": "DC接地端子",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  53
                ],
                "functions": [
                  "DC接地端子"
                ],
                "remarks": [
                  "丰迪"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A03101932"
                ],
                "suppliers": [
                  "丰迪"
                ],
                "sapNos": [
                  "A03101932"
                ],
                "assemblyRefs": [
                  "DC接地端子"
                ],
                "kind": "connector",
                "groupKey": "dc_ground"
              }
            }
          ]
        },
        {
          "key": "ac_ground",
          "label": "AC 接地端子",
          "section": "connector",
          "quoteCount": 1,
          "fixedCount": 1,
          "matchedCount": 0,
          "quoteOnlyCount": 1,
          "fixedOnlyCount": 1,
          "assemblyToPartsCount": 0,
          "assemblyPartCount": 0,
          "aligned": [
            {
              "itemKey": "K03005541",
              "status": "quote_only",
              "quote": {
                "itemKey": "K03005541",
                "partNumber": "K03005541",
                "partName": "AC接地端子",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  19
                ],
                "functions": [
                  "AC接地端子"
                ],
                "remarks": [
                  "丰迪/荣盛达"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A03101932"
                ],
                "suppliers": [
                  "丰迪/荣盛达"
                ],
                "sapNos": [
                  "A03101932"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "ac_ground"
              },
              "fixed": null
            },
            {
              "itemKey": "K03006773",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "K03006773",
                "partNumber": "K03006773",
                "partName": "AC接地端子",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  52
                ],
                "functions": [
                  "AC接地端子"
                ],
                "remarks": [
                  "丰迪"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A03103446"
                ],
                "suppliers": [
                  "丰迪"
                ],
                "sapNos": [
                  "A03103446"
                ],
                "assemblyRefs": [
                  "AC接地端子"
                ],
                "kind": "connector",
                "groupKey": "ac_ground"
              }
            }
          ]
        },
        {
          "key": "wires",
          "label": "导线",
          "section": "wire",
          "quoteCount": 5,
          "fixedCount": 20,
          "matchedCount": 4,
          "quoteOnlyCount": 1,
          "fixedOnlyCount": 16,
          "assemblyToPartsCount": 0,
          "assemblyPartCount": 0,
          "aligned": [
            {
              "itemKey": "FHLALR2G/120.0/橙",
              "status": "matched",
              "quote": {
                "itemKey": "FHLALR2G/120.0/橙",
                "partNumber": "FHLALR2G/120.0/橙",
                "partName": "120mm²单芯非屏蔽铝导线",
                "unit": "M",
                "quantity": 2.75,
                "rowNumbers": [
                  21
                ],
                "functions": [],
                "remarks": [
                  "太平洋/鑫宏业/斯普乐"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01101891"
                ],
                "suppliers": [
                  "太平洋/鑫宏业/斯普乐"
                ],
                "sapNos": [
                  "A01101891"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              },
              "fixed": {
                "itemKey": "FHLALR2G/120.0/橙",
                "partNumber": "FHLALR2G/120.0/橙",
                "partName": "120mm²单芯非屏蔽铝导线",
                "unit": "M",
                "quantity": 2.75,
                "rowNumbers": [
                  57
                ],
                "functions": [],
                "remarks": [
                  "鑫宏业"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01101891"
                ],
                "suppliers": [
                  "鑫宏业"
                ],
                "sapNos": [
                  "A01101891"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            },
            {
              "itemKey": "FHLALR91X/6.0/橙",
              "status": "quote_only",
              "quote": {
                "itemKey": "FHLALR91X/6.0/橙",
                "partNumber": "FHLALR91X/6.0/橙",
                "partName": "6mm²单芯非屏蔽铝导线",
                "unit": "M",
                "quantity": 2.86,
                "rowNumbers": [
                  22
                ],
                "functions": [],
                "remarks": [
                  "鑫宏业/斯普乐"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "鑫宏业/斯普乐"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              },
              "fixed": null
            },
            {
              "itemKey": "FHL91X/6.0/黄绿",
              "status": "matched",
              "quote": {
                "itemKey": "FHL91X/6.0/黄绿",
                "partNumber": "FHL91X/6.0/黄绿",
                "partName": "6mm²单芯铜导线",
                "unit": "M",
                "quantity": 0.23,
                "rowNumbers": [
                  23
                ],
                "functions": [],
                "remarks": [
                  "鑫宏业/斯普乐"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01101944"
                ],
                "suppliers": [
                  "鑫宏业/斯普乐"
                ],
                "sapNos": [
                  "A01101944"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              },
              "fixed": {
                "itemKey": "FHL91X/6.0/黄绿",
                "partNumber": "FHL91X/6.0/黄绿",
                "partName": "6mm²单芯铜导线",
                "unit": "M",
                "quantity": 0.23,
                "rowNumbers": [
                  59
                ],
                "functions": [],
                "remarks": [
                  "鑫宏业"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01102926"
                ],
                "suppliers": [
                  "鑫宏业"
                ],
                "sapNos": [
                  "A01102926"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            },
            {
              "itemKey": "FHL91X/5.0/黄绿",
              "status": "matched",
              "quote": {
                "itemKey": "FHL91X/5.0/黄绿",
                "partNumber": "FHL91X/5.0/黄绿",
                "partName": "5mm²单芯铜导线",
                "unit": "M",
                "quantity": 0.25,
                "rowNumbers": [
                  24
                ],
                "functions": [],
                "remarks": [
                  "鑫宏业/斯普乐"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "鑫宏业/斯普乐"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              },
              "fixed": {
                "itemKey": "FHL91X/5.0/黄绿",
                "partNumber": "FHL91X/5.0/黄绿",
                "partName": "5mm²单芯铜导线",
                "unit": "M",
                "quantity": 0.25,
                "rowNumbers": [
                  60
                ],
                "functions": [],
                "remarks": [
                  "鑫宏业"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01103405"
                ],
                "suppliers": [
                  "鑫宏业"
                ],
                "sapNos": [
                  "A01103405"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            },
            {
              "itemKey": "FLRY-B/0.5/黑",
              "status": "matched",
              "quote": {
                "itemKey": "FLRY-B/0.5/黑",
                "partNumber": "FLRY-B/0.5/黑",
                "partName": "低压导线",
                "unit": "M",
                "quantity": 9.9,
                "rowNumbers": [
                  25
                ],
                "functions": [],
                "remarks": [
                  "福斯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01011796"
                ],
                "suppliers": [
                  "福斯"
                ],
                "sapNos": [
                  "A01011796"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              },
              "fixed": {
                "itemKey": "FLRY-B/0.5/黑",
                "partNumber": "FLRY-B/0.5/黑",
                "partName": "0.5低压导线",
                "unit": "M",
                "quantity": 1,
                "rowNumbers": [
                  65
                ],
                "functions": [],
                "remarks": [
                  "福斯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01011796"
                ],
                "suppliers": [
                  "福斯"
                ],
                "sapNos": [
                  "A01011796"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            },
            {
              "itemKey": "FHLAL91X/6.0/橙/AL8",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "FHLAL91X/6.0/橙/AL8",
                "partNumber": "FHLAL91X/6.0/橙/AL8",
                "partName": "6mm²单芯非屏蔽铝导线",
                "unit": "M",
                "quantity": 2.86,
                "rowNumbers": [
                  58
                ],
                "functions": [],
                "remarks": [
                  "鑫宏业"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01103404"
                ],
                "suppliers": [
                  "鑫宏业"
                ],
                "sapNos": [
                  "A01103404"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            },
            {
              "itemKey": "FLRY-B/0.5/棕兰",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "FLRY-B/0.5/棕兰",
                "partNumber": "FLRY-B/0.5/棕兰",
                "partName": "0.5低压导线",
                "unit": "M",
                "quantity": 0.56,
                "rowNumbers": [
                  61
                ],
                "functions": [],
                "remarks": [
                  "福斯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01011830"
                ],
                "suppliers": [
                  "福斯"
                ],
                "sapNos": [
                  "A01011830"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            },
            {
              "itemKey": "FLRY-B/0.5/棕",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "FLRY-B/0.5/棕",
                "partNumber": "FLRY-B/0.5/棕",
                "partName": "0.5低压导线",
                "unit": "M",
                "quantity": 0.51,
                "rowNumbers": [
                  62
                ],
                "functions": [],
                "remarks": [
                  "福斯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01011832"
                ],
                "suppliers": [
                  "福斯"
                ],
                "sapNos": [
                  "A01011832"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            },
            {
              "itemKey": "FLRY-B/0.5/兰黄",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "FLRY-B/0.5/兰黄",
                "partNumber": "FLRY-B/0.5/兰黄",
                "partName": "0.5低压导线",
                "unit": "M",
                "quantity": 0.51,
                "rowNumbers": [
                  63
                ],
                "functions": [],
                "remarks": [
                  "福斯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01011805"
                ],
                "suppliers": [
                  "福斯"
                ],
                "sapNos": [
                  "A01011805"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            },
            {
              "itemKey": "FLRY-B/0.5/红",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "FLRY-B/0.5/红",
                "partNumber": "FLRY-B/0.5/红",
                "partName": "0.5低压导线",
                "unit": "M",
                "quantity": 0.51,
                "rowNumbers": [
                  64
                ],
                "functions": [],
                "remarks": [
                  "福斯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01011755"
                ],
                "suppliers": [
                  "福斯"
                ],
                "sapNos": [
                  "A01011755"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            },
            {
              "itemKey": "FLRY-B/0.5/兰",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "FLRY-B/0.5/兰",
                "partNumber": "FLRY-B/0.5/兰",
                "partName": "0.5低压导线",
                "unit": "M",
                "quantity": 0.51,
                "rowNumbers": [
                  66
                ],
                "functions": [],
                "remarks": [
                  "福斯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01011808"
                ],
                "suppliers": [
                  "福斯"
                ],
                "sapNos": [
                  "A01011808"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            },
            {
              "itemKey": "FLRY-B/0.5/黄黑",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "FLRY-B/0.5/黄黑",
                "partNumber": "FLRY-B/0.5/黄黑",
                "partName": "0.5低压导线",
                "unit": "M",
                "quantity": 0.56,
                "rowNumbers": [
                  67
                ],
                "functions": [],
                "remarks": [
                  "福斯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01011774"
                ],
                "suppliers": [
                  "福斯"
                ],
                "sapNos": [
                  "A01011774"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            },
            {
              "itemKey": "FLRY-B/0.5/白",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "FLRY-B/0.5/白",
                "partNumber": "FLRY-B/0.5/白",
                "partName": "0.5低压导线",
                "unit": "M",
                "quantity": 0.56,
                "rowNumbers": [
                  68
                ],
                "functions": [],
                "remarks": [
                  "福斯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01011749"
                ],
                "suppliers": [
                  "福斯"
                ],
                "sapNos": [
                  "A01011749"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            },
            {
              "itemKey": "FLRY-B/0.5/黄",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "FLRY-B/0.5/黄",
                "partNumber": "FLRY-B/0.5/黄",
                "partName": "0.5低压导线",
                "unit": "M",
                "quantity": 0.56,
                "rowNumbers": [
                  69
                ],
                "functions": [],
                "remarks": [
                  "福斯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01011771"
                ],
                "suppliers": [
                  "福斯"
                ],
                "sapNos": [
                  "A01011771"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            },
            {
              "itemKey": "FLRY-B/0.5/黑白",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "FLRY-B/0.5/黑白",
                "partNumber": "FLRY-B/0.5/黑白",
                "partName": "0.5低压导线",
                "unit": "M",
                "quantity": 0.56,
                "rowNumbers": [
                  70
                ],
                "functions": [],
                "remarks": [
                  "福斯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01011792"
                ],
                "suppliers": [
                  "福斯"
                ],
                "sapNos": [
                  "A01011792"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            },
            {
              "itemKey": "FLRY-B/0.5/黄白",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "FLRY-B/0.5/黄白",
                "partNumber": "FLRY-B/0.5/黄白",
                "partName": "0.5低压导线",
                "unit": "M",
                "quantity": 0.56,
                "rowNumbers": [
                  71
                ],
                "functions": [],
                "remarks": [
                  "福斯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01011769"
                ],
                "suppliers": [
                  "福斯"
                ],
                "sapNos": [
                  "A01011769"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            },
            {
              "itemKey": "FLRY-B/0.5/红白",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "FLRY-B/0.5/红白",
                "partNumber": "FLRY-B/0.5/红白",
                "partName": "0.5低压导线",
                "unit": "M",
                "quantity": 0.56,
                "rowNumbers": [
                  72
                ],
                "functions": [],
                "remarks": [
                  "福斯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01011754"
                ],
                "suppliers": [
                  "福斯"
                ],
                "sapNos": [
                  "A01011754"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            },
            {
              "itemKey": "FLRY-B/0.5/绿白",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "FLRY-B/0.5/绿白",
                "partNumber": "FLRY-B/0.5/绿白",
                "partName": "0.5低压导线",
                "unit": "M",
                "quantity": 0.56,
                "rowNumbers": [
                  73
                ],
                "functions": [],
                "remarks": [
                  "福斯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01011780"
                ],
                "suppliers": [
                  "福斯"
                ],
                "sapNos": [
                  "A01011780"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            },
            {
              "itemKey": "FLRY-B/0.5/绿黑",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "FLRY-B/0.5/绿黑",
                "partNumber": "FLRY-B/0.5/绿黑",
                "partName": "0.5低压导线",
                "unit": "M",
                "quantity": 0.51,
                "rowNumbers": [
                  74
                ],
                "functions": [],
                "remarks": [
                  "福斯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01011786"
                ],
                "suppliers": [
                  "福斯"
                ],
                "sapNos": [
                  "A01011786"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            },
            {
              "itemKey": "FLRY-B/0.5/粉",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "FLRY-B/0.5/粉",
                "partNumber": "FLRY-B/0.5/粉",
                "partName": "0.5低压导线",
                "unit": "M",
                "quantity": 0.51,
                "rowNumbers": [
                  75
                ],
                "functions": [],
                "remarks": [
                  "福斯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01000221"
                ],
                "suppliers": [
                  "福斯"
                ],
                "sapNos": [
                  "A01000221"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            },
            {
              "itemKey": "FLRY-B/0.5/紫白",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "FLRY-B/0.5/紫白",
                "partNumber": "FLRY-B/0.5/紫白",
                "partName": "0.5低压导线",
                "unit": "M",
                "quantity": 0.51,
                "rowNumbers": [
                  76
                ],
                "functions": [],
                "remarks": [
                  "福斯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01011813"
                ],
                "suppliers": [
                  "福斯"
                ],
                "sapNos": [
                  "A01011813"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            }
          ]
        },
        {
          "key": "sync_brackets",
          "label": "支架类（同步开发件）",
          "section": "sync",
          "quoteCount": 6,
          "fixedCount": 5,
          "matchedCount": 4,
          "quoteOnlyCount": 2,
          "fixedOnlyCount": 1,
          "assemblyToPartsCount": 0,
          "assemblyPartCount": 0,
          "aligned": [
            {
              "itemKey": "G281-HB-01",
              "status": "quote_only",
              "quote": {
                "itemKey": "G281-HB-01",
                "partNumber": "G281-HB-01",
                "partName": "塑料护板上盖",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  32
                ],
                "functions": [],
                "remarks": [
                  "博昊/天久/华凯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "博昊/天久/华凯"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              },
              "fixed": null
            },
            {
              "itemKey": "G281-HB-02",
              "status": "quote_only",
              "quote": {
                "itemKey": "G281-HB-02",
                "partNumber": "G281-HB-02",
                "partName": "塑料护板下盖",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  33
                ],
                "functions": [],
                "remarks": [
                  "博昊/天久/华凯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "博昊/天久/华凯"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              },
              "fixed": null
            },
            {
              "itemKey": "G281-ZJ-01",
              "status": "matched",
              "quote": {
                "itemKey": "G281-ZJ-01",
                "partNumber": "G281-ZJ-01",
                "partName": "金属支架",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  34
                ],
                "functions": [],
                "remarks": [
                  "恒伟林/贵龙/华凯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "恒伟林/贵龙/华凯"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              },
              "fixed": {
                "itemKey": "G281-ZJ-01",
                "partNumber": "G281-ZJ-01",
                "partName": "金属支架",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  84
                ],
                "functions": [],
                "remarks": [
                  "贵龙"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06102152"
                ],
                "suppliers": [
                  "贵龙"
                ],
                "sapNos": [
                  "A06102152"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              }
            },
            {
              "itemKey": "G281-ZJ-02",
              "status": "matched",
              "quote": {
                "itemKey": "G281-ZJ-02",
                "partNumber": "G281-ZJ-02",
                "partName": "金属支架",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  35
                ],
                "functions": [],
                "remarks": [
                  "恒伟林/贵龙/华凯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "恒伟林/贵龙/华凯"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              },
              "fixed": {
                "itemKey": "G281-ZJ-02",
                "partNumber": "G281-ZJ-02",
                "partName": "金属支架",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  85
                ],
                "functions": [],
                "remarks": [
                  "贵龙"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06102151"
                ],
                "suppliers": [
                  "贵龙"
                ],
                "sapNos": [
                  "A06102151"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              }
            },
            {
              "itemKey": "G281-ZJ-03",
              "status": "matched",
              "quote": {
                "itemKey": "G281-ZJ-03",
                "partNumber": "G281-ZJ-03",
                "partName": "金属支架",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  36
                ],
                "functions": [],
                "remarks": [
                  "恒伟林/贵龙/华凯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "恒伟林/贵龙/华凯"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              },
              "fixed": {
                "itemKey": "G281-ZJ-03",
                "partNumber": "G281-ZJ-03",
                "partName": "金属支架",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  86
                ],
                "functions": [],
                "remarks": [
                  "贵龙"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06102150"
                ],
                "suppliers": [
                  "贵龙"
                ],
                "sapNos": [
                  "A06102150"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              }
            },
            {
              "itemKey": "G281-ZJ-04",
              "status": "matched",
              "quote": {
                "itemKey": "G281-ZJ-04",
                "partNumber": "G281-ZJ-04",
                "partName": "金属支架",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  37
                ],
                "functions": [],
                "remarks": [
                  "恒伟林/贵龙/华凯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "恒伟林/贵龙/华凯"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              },
              "fixed": {
                "itemKey": "G281-ZJ-04",
                "partNumber": "G281-ZJ-04",
                "partName": "金属支架",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  87
                ],
                "functions": [],
                "remarks": [
                  "华凯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06102149"
                ],
                "suppliers": [
                  "华凯"
                ],
                "sapNos": [
                  "A06102149"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              }
            },
            {
              "itemKey": "G281-HB-07",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "G281-HB-07",
                "partNumber": "G281-HB-07",
                "partName": "塑料护板",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  83
                ],
                "functions": [],
                "remarks": [
                  "上海程达"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06102153"
                ],
                "suppliers": [
                  "上海程达"
                ],
                "sapNos": [
                  "A06102153"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              }
            }
          ]
        },
        {
          "key": "sync_rubber",
          "label": "橡胶件类（同步开发件）",
          "section": "sync",
          "quoteCount": 4,
          "fixedCount": 5,
          "matchedCount": 4,
          "quoteOnlyCount": 0,
          "fixedOnlyCount": 1,
          "assemblyToPartsCount": 0,
          "assemblyPartCount": 0,
          "aligned": [
            {
              "itemKey": "G281-XJ-01",
              "status": "matched",
              "quote": {
                "itemKey": "G281-XJ-01",
                "partNumber": "G281-XJ-01",
                "partName": "橡胶件",
                "unit": "PCS",
                "quantity": 3,
                "rowNumbers": [
                  38
                ],
                "functions": [],
                "remarks": [
                  "恒伟林/远信/博昊/天乐"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "恒伟林/远信/博昊/天乐"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_rubber"
              },
              "fixed": {
                "itemKey": "G281-XJ-01",
                "partNumber": "G281-XJ-01",
                "partName": "橡胶件",
                "unit": "PCS",
                "quantity": 3,
                "rowNumbers": [
                  88
                ],
                "functions": [],
                "remarks": [
                  "博昊"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "博昊"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_rubber"
              }
            },
            {
              "itemKey": "G281-XJ-02",
              "status": "matched",
              "quote": {
                "itemKey": "G281-XJ-02",
                "partNumber": "G281-XJ-02",
                "partName": "橡胶件",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  39
                ],
                "functions": [],
                "remarks": [
                  "恒伟林/远信/博昊/天乐"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "恒伟林/远信/博昊/天乐"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_rubber"
              },
              "fixed": {
                "itemKey": "G281-XJ-02",
                "partNumber": "G281-XJ-02",
                "partName": "橡胶件",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  89
                ],
                "functions": [],
                "remarks": [
                  "博昊"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "博昊"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_rubber"
              }
            },
            {
              "itemKey": "G281-XJ-03",
              "status": "matched",
              "quote": {
                "itemKey": "G281-XJ-03",
                "partNumber": "G281-XJ-03",
                "partName": "橡胶件",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  40
                ],
                "functions": [],
                "remarks": [
                  "恒伟林/远信/博昊/天乐"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "恒伟林/远信/博昊/天乐"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_rubber"
              },
              "fixed": {
                "itemKey": "G281-XJ-03",
                "partNumber": "G281-XJ-03",
                "partName": "橡胶件",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  90
                ],
                "functions": [],
                "remarks": [
                  "博昊"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "博昊"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_rubber"
              }
            },
            {
              "itemKey": "G281-XJ-04",
              "status": "matched",
              "quote": {
                "itemKey": "G281-XJ-04",
                "partNumber": "G281-XJ-04",
                "partName": "橡胶件",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  41
                ],
                "functions": [],
                "remarks": [
                  "恒伟林/远信/博昊/天乐"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "恒伟林/远信/博昊/天乐"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_rubber"
              },
              "fixed": {
                "itemKey": "G281-XJ-04",
                "partNumber": "G281-XJ-04",
                "partName": "橡胶件",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  91
                ],
                "functions": [],
                "remarks": [
                  "博昊"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "博昊"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_rubber"
              }
            },
            {
              "itemKey": "G281-XJ-09",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "G281-XJ-09",
                "partNumber": "G281-XJ-09",
                "partName": "橡胶件",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  92
                ],
                "functions": [
                  "原G281-XJ-11"
                ],
                "remarks": [
                  "博昊"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "博昊"
                ],
                "sapNos": [],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_rubber"
              }
            }
          ]
        },
        {
          "key": "materials",
          "label": "其他物料",
          "section": "material",
          "quoteCount": 20,
          "fixedCount": 25,
          "matchedCount": 11,
          "quoteOnlyCount": 9,
          "fixedOnlyCount": 14,
          "assemblyToPartsCount": 0,
          "assemblyPartCount": 0,
          "aligned": [
            {
              "itemKey": "2377665-4",
              "status": "quote_only",
              "quote": {
                "itemKey": "2377665-4",
                "partNumber": "2377665-4",
                "partName": "防水栓",
                "unit": "PCS",
                "quantity": 18,
                "rowNumbers": [
                  10
                ],
                "functions": [],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A03033097"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "A03033097"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": null
            },
            {
              "itemKey": "963143-1",
              "status": "quote_only",
              "quote": {
                "itemKey": "963143-1",
                "partNumber": "963143-1",
                "partName": "盲栓（1/8/15/22）",
                "unit": "PCS",
                "quantity": 4,
                "rowNumbers": [
                  11
                ],
                "functions": [],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02031363"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "A02031363"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": null
            },
            {
              "itemKey": "BH4309802",
              "status": "matched",
              "quote": {
                "itemKey": "BH4309802",
                "partNumber": "BH4309802",
                "partName": "箭头扎带卡花",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  12
                ],
                "functions": [],
                "remarks": [
                  "博昊"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A06100441"
                ],
                "suppliers": [
                  "博昊"
                ],
                "sapNos": [
                  "A06100441"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "BH4309802",
                "partNumber": "BH4309802",
                "partName": "箭头扎带卡花",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  40
                ],
                "functions": [],
                "remarks": [
                  "博昊"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A06100441"
                ],
                "suppliers": [
                  "博昊"
                ],
                "sapNos": [
                  "A06100441"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "10800507250",
              "status": "quote_only",
              "quote": {
                "itemKey": "10800507250",
                "partNumber": "10800507250",
                "partName": "防水栓",
                "unit": "PCS",
                "quantity": 4,
                "rowNumbers": [
                  17
                ],
                "functions": [],
                "remarks": [
                  "赫尔斯曼"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A03011408"
                ],
                "suppliers": [
                  "赫尔斯曼"
                ],
                "sapNos": [
                  "A03011408"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": null
            },
            {
              "itemKey": "10106880",
              "status": "quote_only",
              "quote": {
                "itemKey": "10106880",
                "partNumber": "10106880",
                "partName": "接地热缩管",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  20
                ],
                "functions": [],
                "remarks": [
                  "深圳宏商/长春海达"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04032364"
                ],
                "suppliers": [
                  "深圳宏商/长春海达"
                ],
                "sapNos": [
                  "A04032364"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": null
            },
            {
              "itemKey": "LG3305D012B",
              "status": "quote_only",
              "quote": {
                "itemKey": "LG3305D012B",
                "partNumber": "LG3305D012B",
                "partName": "12OR橙色波纹管",
                "unit": "M",
                "quantity": 1.2,
                "rowNumbers": [
                  26
                ],
                "functions": [],
                "remarks": [
                  "骏鼎达/诗兰姆"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101161"
                ],
                "suppliers": [
                  "骏鼎达/诗兰姆"
                ],
                "sapNos": [
                  "A04101161"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": null
            },
            {
              "itemKey": "SCS2165A019",
              "status": "matched",
              "quote": {
                "itemKey": "SCS2165A019",
                "partNumber": "SCS2165A019",
                "partName": "19OR橙色编织套管",
                "unit": "M",
                "quantity": 2.25,
                "rowNumbers": [
                  27
                ],
                "functions": [],
                "remarks": [
                  "骏鼎达/明鑫"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101671"
                ],
                "suppliers": [
                  "骏鼎达/明鑫"
                ],
                "sapNos": [
                  "A04101671"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "SCS2165A019",
                "partNumber": "SCS2165A019",
                "partName": "19OR橙色编织套管",
                "unit": "M",
                "quantity": 2.25,
                "rowNumbers": [
                  78
                ],
                "functions": [],
                "remarks": [
                  "骏鼎达"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101671"
                ],
                "suppliers": [
                  "骏鼎达"
                ],
                "sapNos": [
                  "A04101671"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "LY5016019-OR2",
              "status": "matched",
              "quote": {
                "itemKey": "LY5016019-OR2",
                "partNumber": "LY5016019-OR2",
                "partName": "橙色布基胶带",
                "unit": "M",
                "quantity": 5,
                "rowNumbers": [
                  28
                ],
                "functions": [],
                "remarks": [
                  "联益"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101159"
                ],
                "suppliers": [
                  "联益"
                ],
                "sapNos": [
                  "A04101159"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "LY5016019-OR2",
                "partNumber": "LY5016019-OR2",
                "partName": "橙色布基胶带",
                "unit": "M",
                "quantity": 5,
                "rowNumbers": [
                  79
                ],
                "functions": [],
                "remarks": [
                  "联益"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101159"
                ],
                "suppliers": [
                  "联益"
                ],
                "sapNos": [
                  "A04101159"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "LY5016019",
              "status": "matched",
              "quote": {
                "itemKey": "LY5016019",
                "partNumber": "LY5016019",
                "partName": "黑色布基胶带",
                "unit": "M",
                "quantity": 1.66,
                "rowNumbers": [
                  29
                ],
                "functions": [],
                "remarks": [
                  "联益"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04030943"
                ],
                "suppliers": [
                  "联益"
                ],
                "sapNos": [
                  "A04030943"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "LY5016019",
                "partNumber": "LY5016019",
                "partName": "黑色布基胶带",
                "unit": "M",
                "quantity": 1.66,
                "rowNumbers": [
                  80
                ],
                "functions": [],
                "remarks": [
                  "联益"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04030943"
                ],
                "suppliers": [
                  "联益"
                ],
                "sapNos": [
                  "A04030943"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "P111W0192510002",
              "status": "quote_only",
              "quote": {
                "itemKey": "P111W0192510002",
                "partNumber": "P111W0192510002",
                "partName": "橙色PVC胶带",
                "unit": "M",
                "quantity": 4.5,
                "rowNumbers": [
                  30
                ],
                "functions": [],
                "remarks": [
                  "亚化"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101670"
                ],
                "suppliers": [
                  "亚化"
                ],
                "sapNos": [
                  "A04101670"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": null
            },
            {
              "itemKey": "6211015110AL",
              "status": "matched",
              "quote": {
                "itemKey": "6211015110AL",
                "partNumber": "6211015110AL",
                "partName": "防水泥",
                "unit": "PCS",
                "quantity": 3,
                "rowNumbers": [
                  31
                ],
                "functions": [],
                "remarks": [
                  "DSG/凯密科"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04010396"
                ],
                "suppliers": [
                  "DSG/凯密科"
                ],
                "sapNos": [
                  "A04010396"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "6211015110AL",
                "partNumber": "6211015110AL",
                "partName": "防水泥",
                "unit": "PCS",
                "quantity": 3,
                "rowNumbers": [
                  82
                ],
                "functions": [],
                "remarks": [
                  "DSG"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04010396"
                ],
                "suppliers": [
                  "DSG"
                ],
                "sapNos": [
                  "A04010396"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "PP9104320",
              "status": "matched",
              "quote": {
                "itemKey": "PP9104320",
                "partNumber": "PP9104320",
                "partName": "7*12箭头扎带",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  42
                ],
                "functions": [],
                "remarks": [
                  "上海众安/海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06101606"
                ],
                "suppliers": [
                  "上海众安/海尔曼太通"
                ],
                "sapNos": [
                  "A06101606"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "PP9104320",
                "partNumber": "PP9104320",
                "partName": "7*12箭头扎带",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  93
                ],
                "functions": [],
                "remarks": [
                  "上海众安"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06101606"
                ],
                "suppliers": [
                  "上海众安"
                ],
                "sapNos": [
                  "A06101606"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "PP9108401",
              "status": "quote_only",
              "quote": {
                "itemKey": "PP9108401",
                "partNumber": "PP9108401",
                "partName": "M8箭头卡扣",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  43
                ],
                "functions": [],
                "remarks": [
                  "上海众安/海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "上海众安/海尔曼太通"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": null
            },
            {
              "itemKey": "PP9122201",
              "status": "matched",
              "quote": {
                "itemKey": "PP9122201",
                "partNumber": "PP9122201",
                "partName": "M6竖置螺柱卡",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  44
                ],
                "functions": [],
                "remarks": [
                  "上海众安/海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06101666"
                ],
                "suppliers": [
                  "上海众安/海尔曼太通"
                ],
                "sapNos": [
                  "A06101666"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "PP9122201",
                "partNumber": "PP9122201",
                "partName": "M6立置螺柱卡",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  95
                ],
                "functions": [],
                "remarks": [
                  "上海众安"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06101666"
                ],
                "suppliers": [
                  "上海众安"
                ],
                "sapNos": [
                  "A06101666"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "PP9123801",
              "status": "quote_only",
              "quote": {
                "itemKey": "PP9123801",
                "partNumber": "PP9123801",
                "partName": "M5螺柱卡扣",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  45
                ],
                "functions": [],
                "remarks": [
                  "上海众安/海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "上海众安/海尔曼太通"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": null
            },
            {
              "itemKey": "PP9117701",
              "status": "matched",
              "quote": {
                "itemKey": "PP9117701",
                "partNumber": "PP9117701",
                "partName": "M6杉树卡扣",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  46
                ],
                "functions": [],
                "remarks": [
                  "上海众安/海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06004922"
                ],
                "suppliers": [
                  "上海众安/海尔曼太通"
                ],
                "sapNos": [
                  "A06004922"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "PP9117701",
                "partNumber": "PP9117701",
                "partName": "M6杉树卡扣",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  97
                ],
                "functions": [],
                "remarks": [
                  "上海众安"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06004922"
                ],
                "suppliers": [
                  "上海众安"
                ],
                "sapNos": [
                  "A06004922"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "PP9220301",
              "status": "matched",
              "quote": {
                "itemKey": "PP9220301",
                "partNumber": "PP9220301",
                "partName": "7*12箭头一字卡",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  47
                ],
                "functions": [],
                "remarks": [
                  "上海众安/海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06004079"
                ],
                "suppliers": [
                  "上海众安/海尔曼太通"
                ],
                "sapNos": [
                  "A06004079"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "PP9220301",
                "partNumber": "PP9220301",
                "partName": "7*12箭头一字卡",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  98
                ],
                "functions": [],
                "remarks": [
                  "上海众安"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06004079"
                ],
                "suppliers": [
                  "上海众安"
                ],
                "sapNos": [
                  "A06004079"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "111-00563",
              "status": "matched",
              "quote": {
                "itemKey": "111-00563",
                "partNumber": "111-00563",
                "partName": "扎带绳",
                "unit": "PCS",
                "quantity": 7,
                "rowNumbers": [
                  48
                ],
                "functions": [],
                "remarks": [
                  "上海众安/海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06010012"
                ],
                "suppliers": [
                  "上海众安/海尔曼太通"
                ],
                "sapNos": [
                  "A06010012"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "111-00563",
                "partNumber": "111-00563",
                "partName": "扎带绳",
                "unit": "PCS",
                "quantity": 5,
                "rowNumbers": [
                  99
                ],
                "functions": [],
                "remarks": [
                  "海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06010012"
                ],
                "suppliers": [
                  "海尔曼太通"
                ],
                "sapNos": [
                  "A06010012"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "108-00150",
              "status": "quote_only",
              "quote": {
                "itemKey": "108-00150",
                "partNumber": "108-00150",
                "partName": "扎带绳",
                "unit": "PCS",
                "quantity": 3,
                "rowNumbers": [
                  49
                ],
                "functions": [],
                "remarks": [
                  "上海众安/海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06100602"
                ],
                "suppliers": [
                  "上海众安/海尔曼太通"
                ],
                "sapNos": [
                  "A06100602"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": null
            },
            {
              "itemKey": "X1-BQ-01标签140X30MM",
              "status": "matched",
              "quote": {
                "itemKey": "X1-BQ-01标签140X30MM",
                "partNumber": "X1-BQ-01 标签140x30mm",
                "partName": "产品标签",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  50
                ],
                "functions": [],
                "remarks": [
                  "洪众"
                ],
                "otherRemarks": [],
                "wireNos": [
                  "70002326"
                ],
                "suppliers": [
                  "洪众"
                ],
                "sapNos": [
                  "70002326"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "X1-BQ-01标签140X30MM",
                "partNumber": "X1-BQ-01 标签140x30mm",
                "partName": "产品标签",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  102
                ],
                "functions": [],
                "remarks": [
                  "洪众"
                ],
                "otherRemarks": [],
                "wireNos": [
                  "70002326"
                ],
                "suppliers": [
                  "洪众"
                ],
                "sapNos": [
                  "70002326"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "2490531-6",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "2490531-6",
                "partNumber": "2490531-6",
                "partName": "法兰盘面板",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  6
                ],
                "functions": [],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A05100638"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "A05100638"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "2333692-1",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "2333692-1",
                "partNumber": "2333692-1",
                "partName": "M3.5螺栓",
                "unit": "PCS",
                "quantity": 6,
                "rowNumbers": [
                  21
                ],
                "functions": [],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A07003208"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "A07003208"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "2333693-1",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "2333693-1",
                "partNumber": "2333693-1",
                "partName": "M5螺栓",
                "unit": "PCS",
                "quantity": 4,
                "rowNumbers": [
                  22
                ],
                "functions": [],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A07003209"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "A07003209"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "5-2435306-1",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "5-2435306-1",
                "partNumber": "5-2435306-1",
                "partName": "盲堵",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  29
                ],
                "functions": [],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02101106"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "A02101106"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "HVSPC2P1900FF-09120",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "HVSPC2P1900FF-09120",
                "partNumber": "HVSPC2P1900FF-09120",
                "partName": "120mm²线夹",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  45
                ],
                "functions": [],
                "remarks": [
                  "安费诺"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02105130"
                ],
                "suppliers": [
                  "安费诺"
                ],
                "sapNos": [
                  "A02105130"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "HVSPC2P1900FF-07120",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "HVSPC2P1900FF-07120",
                "partNumber": "HVSPC2P1900FF-07120",
                "partName": "120mm²后盖",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  46
                ],
                "functions": [],
                "remarks": [
                  "安费诺"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02105125"
                ],
                "suppliers": [
                  "安费诺"
                ],
                "sapNos": [
                  "A02105125"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "HDGW12-30",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "HDGW12-30",
                "partNumber": "HDGW 12-30",
                "partName": "带胶-热缩管-黑色",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  54
                ],
                "functions": [
                  "AC-PE和DC-PE热缩管"
                ],
                "remarks": [
                  "长春海达"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04102221"
                ],
                "suppliers": [
                  "长春海达"
                ],
                "sapNos": [
                  "A04102221"
                ],
                "assemblyRefs": [
                  "AC-PE和DC-PE热缩管"
                ],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "HS-125(3X)9-30耐温125℃，内径8长度验证，申请样品验证后建号",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "HS-125(3X)9-30耐温125℃，内径8长度验证，申请样品验证后建号",
                "partNumber": "HS-125(3X) 9-30 耐温125℃，内径8长度验证，申请样品验证后建号",
                "partName": "不带胶-热缩管黑色",
                "unit": "PCS",
                "quantity": 4,
                "rowNumbers": [
                  55
                ],
                "functions": [
                  "L1/N/AC-PE/DC-PE使用热缩管"
                ],
                "remarks": [
                  "长春海达"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "长春海达"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [
                  "L1/N/AC-PE/DC-PE使用热缩管"
                ],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "LG3305R010B",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "LG3305R010B",
                "partNumber": "LG3305R010B",
                "partName": "10OR橙色波纹管",
                "unit": "M",
                "quantity": 1.2,
                "rowNumbers": [
                  77
                ],
                "functions": [],
                "remarks": [
                  "骏鼎达"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04102623"
                ],
                "suppliers": [
                  "骏鼎达"
                ],
                "sapNos": [
                  "A04102623"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "P111W0192510003",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "P111W0192510003",
                "partNumber": "P111W0192510003",
                "partName": "橙色PVC胶带",
                "unit": "M",
                "quantity": 4.5,
                "rowNumbers": [
                  81
                ],
                "functions": [],
                "remarks": [
                  "亚化"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101791"
                ],
                "suppliers": [
                  "亚化"
                ],
                "sapNos": [
                  "A04101791"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "126-00177",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "126-00177",
                "partNumber": "126-00177",
                "partName": "M6.5箭头卡扣",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  94
                ],
                "functions": [],
                "remarks": [
                  "海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06004365"
                ],
                "suppliers": [
                  "海尔曼太通"
                ],
                "sapNos": [
                  "A06004365"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "PP9120801",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "PP9120801",
                "partNumber": "PP9120801",
                "partName": "M6侧置螺柱卡",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  96
                ],
                "functions": [],
                "remarks": [
                  "上海众安"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06004924"
                ],
                "suppliers": [
                  "上海众安"
                ],
                "sapNos": [
                  "A06004924"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "111-00580",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "111-00580",
                "partNumber": "111-00580",
                "partName": "扎带绳",
                "unit": "PCS",
                "quantity": 4,
                "rowNumbers": [
                  100
                ],
                "functions": [],
                "remarks": [
                  "海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06000221"
                ],
                "suppliers": [
                  "海尔曼太通"
                ],
                "sapNos": [
                  "A06000221"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "PP9127401",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "PP9127401",
                "partNumber": "PP9127401",
                "partName": "隔线扎带绳",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  101
                ],
                "functions": [],
                "remarks": [
                  "上海众安"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06101064"
                ],
                "suppliers": [
                  "上海众安"
                ],
                "sapNos": [
                  "A06101064"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            }
          ]
        }
      ]
    },
    "6608491523": {
      "harnessId": "6608491523",
      "harnessName": "直流母线总成",
      "quoteSheet": "6608491523",
      "fixedSheet": "6608491523-35方",
      "sources": {
        "quote": {
          "sheet": "6608491523",
          "itemCount": 11
        },
        "fixed": {
          "sheet": "6608491523-35方",
          "itemCount": 25
        }
      },
      "summary": {
        "groupCount": 6,
        "connectorGroupCount": 2,
        "syncGroupCount": 2,
        "quoteItemCount": 11,
        "fixedItemCount": 25,
        "matchedCount": 7,
        "quoteOnlyCount": 2,
        "fixedOnlyCount": 3,
        "assemblyToPartsCount": 2,
        "assemblyPartCount": 15,
        "wireMatchedCount": 0,
        "syncMatchedCount": 3,
        "materialMatchedCount": 7
      },
      "groups": [
        {
          "key": "battery_end",
          "label": "接电池端",
          "section": "connector",
          "quoteCount": 1,
          "fixedCount": 8,
          "matchedCount": 0,
          "quoteOnlyCount": 0,
          "fixedOnlyCount": 0,
          "assemblyToPartsCount": 1,
          "assemblyPartCount": 8,
          "aligned": [
            {
              "itemKey": "HVPC2P1600FV550-NH-P010",
              "status": "assembly_to_parts",
              "mappingType": "assembly_to_parts",
              "quote": {
                "itemKey": "HVPC2P1600FV550-NH-P010",
                "partNumber": "HVPC2P1600FV550-NH-P010",
                "partName": "连接器总成",
                "unit": "SET",
                "quantity": 1,
                "rowNumbers": [
                  5
                ],
                "functions": [
                  "接电池端"
                ],
                "remarks": [
                  "安费诺"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "安费诺"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [
                  "HVPC2P1600FV550-NH-P010"
                ],
                "kind": "connector",
                "groupKey": "battery_end"
              },
              "fixed": null,
              "fixedParts": [
                {
                  "itemKey": "HVPC2P1600FT5-NH-MP010",
                  "partNumber": "HVPC2P1600FT5-NH-MP010",
                  "partName": "护套（145度反装 A键位）",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    5
                  ],
                  "functions": [
                    "接电池端"
                  ],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105032"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02105032"
                  ],
                  "assemblyRefs": [
                    "HVPC2P1600FT535-NH-P010 接电池端 适配2*35mm²屏蔽铜包铝硅胶铝导线"
                  ],
                  "kind": "connector",
                  "groupKey": "battery_end"
                },
                {
                  "itemKey": "HVPC2P1600FT-09P010",
                  "partNumber": "HVPC2P1600FT-09P010",
                  "partName": "插头端子-单粒焊接",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    6
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03103389"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A03103389"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "battery_end"
                },
                {
                  "itemKey": "HVPC2P1600FV-15P010",
                  "partNumber": "HVPC2P1600FV-15P010",
                  "partName": "挡板",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    7
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02104375"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02104375"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "battery_end"
                },
                {
                  "itemKey": "HVPC2P1600FV-06-35P010",
                  "partNumber": "HVPC2P1600FV-06-35P010",
                  "partName": "插头外屏蔽环",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    8
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03103387"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A03103387"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "battery_end"
                },
                {
                  "itemKey": "HVC2P80FS1-47P010",
                  "partNumber": "HVC2P80FS1-47P010",
                  "partName": "插头屏蔽内环",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    9
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03103388"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A03103388"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "battery_end"
                },
                {
                  "itemKey": "HVPC2P1600FV-12-35P010",
                  "partNumber": "HVPC2P1600FV-12-35P010",
                  "partName": "插头线束密封圈",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    10
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105020"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02105020"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "battery_end"
                },
                {
                  "itemKey": "HVPC2P1600FV-11-35P010",
                  "partNumber": "HVPC2P1600FV-11-35P010",
                  "partName": "插头线卡",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    11
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105018"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02105018"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "battery_end"
                },
                {
                  "itemKey": "HVPC2P1600FV-10-35P010",
                  "partNumber": "HVPC2P1600FV-10-35P010",
                  "partName": "插头尾盖",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    12
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105019"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02105019"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "battery_end"
                }
              ]
            }
          ]
        },
        {
          "key": "edrive_end",
          "label": "接电驱端",
          "section": "connector",
          "quoteCount": 1,
          "fixedCount": 7,
          "matchedCount": 0,
          "quoteOnlyCount": 0,
          "fixedOnlyCount": 0,
          "assemblyToPartsCount": 1,
          "assemblyPartCount": 7,
          "aligned": [
            {
              "itemKey": "IPT2PFS050-S02P010",
              "status": "assembly_to_parts",
              "mappingType": "assembly_to_parts",
              "quote": {
                "itemKey": "IPT2PFS050-S02P010",
                "partNumber": "IPT2PFS050-S02P010",
                "partName": "IPT连接器总成（带焊接端子）",
                "unit": "SET",
                "quantity": 1,
                "rowNumbers": [
                  6
                ],
                "functions": [
                  "接电驱"
                ],
                "remarks": [
                  "安费诺"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "安费诺"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [
                  "IPT2PFS050-S02P010"
                ],
                "kind": "connector",
                "groupKey": "edrive_end"
              },
              "fixed": null,
              "fixedParts": [
                {
                  "itemKey": "N022525276C",
                  "partNumber": "N022525276C",
                  "partName": "焊接端子-70",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    13
                  ],
                  "functions": [
                    "接电驱端"
                  ],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03103440"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A03103440"
                  ],
                  "assemblyRefs": [
                    "IPT2PFS035-S02P010（安费诺） 接电驱端 适配2*35mm²屏蔽铜包铝硅胶铝导线"
                  ],
                  "kind": "connector",
                  "groupKey": "edrive_end"
                },
                {
                  "itemKey": "IPT2PFS035-GA-01P010",
                  "partNumber": "IPT2PFS035-GA-01P010",
                  "partName": "主体组合件",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    14
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02102660"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02102660"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "edrive_end"
                },
                {
                  "itemKey": "IPT2PFS-S01-35P010",
                  "partNumber": "IPT2PFS-S01-35P010",
                  "partName": "压接屏蔽内环-35",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    15
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03101954"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A03101954"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "edrive_end"
                },
                {
                  "itemKey": "IPT2PFS-S02-35P010",
                  "partNumber": "IPT2PFS-S02-35P010",
                  "partName": "压接屏蔽外环-35/50",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    16
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03101953"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A03101953"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "edrive_end"
                },
                {
                  "itemKey": "IPT2PFS-M04-35P010",
                  "partNumber": "IPT2PFS-M04-35P010",
                  "partName": "屏蔽固定件-16/25/35",
                  "unit": "PCS",
                  "quantity": 4,
                  "rowNumbers": [
                    17
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02102662"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02102662"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "edrive_end"
                },
                {
                  "itemKey": "IPT2PFS-R02-35P010",
                  "partNumber": "IPT2PFS-R02-35P010",
                  "partName": "密封圈-35",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    18
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02102663"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02102663"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "edrive_end"
                },
                {
                  "itemKey": "IPT2PFS-M05-35P010",
                  "partNumber": "IPT2PFS-M05-35P010",
                  "partName": "尾盖-35",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    19
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105144"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02105144"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "edrive_end"
                }
              ]
            }
          ]
        },
        {
          "key": "wires",
          "label": "导线",
          "section": "wire",
          "quoteCount": 1,
          "fixedCount": 1,
          "matchedCount": 0,
          "quoteOnlyCount": 1,
          "fixedOnlyCount": 1,
          "assemblyToPartsCount": 0,
          "assemblyPartCount": 0,
          "aligned": [
            {
              "itemKey": "FHLALR2GCCAATB2G/50.0/橙",
              "status": "quote_only",
              "quote": {
                "itemKey": "FHLALR2GCCAATB2G/50.0/橙",
                "partNumber": "FHLALR2GCCAATB2G/50.0/橙",
                "partName": "50mm²屏蔽镀锡铜包铝硅胶铝导线",
                "unit": "M",
                "quantity": 1.54,
                "rowNumbers": [
                  8
                ],
                "functions": [],
                "remarks": [
                  "太平洋/鑫宏业"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "太平洋/鑫宏业"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              },
              "fixed": null
            },
            {
              "itemKey": "FHLALR2GCCAATB2G/35.0/橙",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "FHLALR2GCCAATB2G/35.0/橙",
                "partNumber": "FHLALR2GCCAATB2G/35.0/橙",
                "partName": "35mm²屏蔽镀锡铜包铝硅胶铝导线",
                "unit": "M",
                "quantity": 1.59,
                "rowNumbers": [
                  21
                ],
                "functions": [],
                "remarks": [
                  "太平洋"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01103420"
                ],
                "suppliers": [
                  "太平洋"
                ],
                "sapNos": [
                  "A01103420"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            }
          ]
        },
        {
          "key": "sync_brackets",
          "label": "支架类（同步开发件）",
          "section": "sync",
          "quoteCount": 2,
          "fixedCount": 2,
          "matchedCount": 2,
          "quoteOnlyCount": 0,
          "fixedOnlyCount": 0,
          "assemblyToPartsCount": 0,
          "assemblyPartCount": 0,
          "aligned": [
            {
              "itemKey": "G281-HB-04",
              "status": "matched",
              "quote": {
                "itemKey": "G281-HB-04",
                "partNumber": "G281-HB-04",
                "partName": "塑料支架",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  11
                ],
                "functions": [],
                "remarks": [
                  "博昊/天久/华凯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "博昊/天久/华凯"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              },
              "fixed": {
                "itemKey": "G281-HB-04",
                "partNumber": "G281-HB-04",
                "partName": "塑料支架（带2个衬套）",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  24
                ],
                "functions": [],
                "remarks": [
                  "上海程达"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06102155"
                ],
                "suppliers": [
                  "上海程达"
                ],
                "sapNos": [
                  "A06102155"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              }
            },
            {
              "itemKey": "G281-ZJ-06",
              "status": "matched",
              "quote": {
                "itemKey": "G281-ZJ-06",
                "partNumber": "G281-ZJ-06",
                "partName": "金属支架",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  12
                ],
                "functions": [],
                "remarks": [
                  "恒伟林/贵龙/华凯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "恒伟林/贵龙/华凯"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              },
              "fixed": {
                "itemKey": "G281-ZJ-06",
                "partNumber": "G281-ZJ-06",
                "partName": "金属支架",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  25
                ],
                "functions": [],
                "remarks": [
                  "华凯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06102146"
                ],
                "suppliers": [
                  "华凯"
                ],
                "sapNos": [
                  "A06102146"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              }
            }
          ]
        },
        {
          "key": "sync_rubber",
          "label": "橡胶件类（同步开发件）",
          "section": "sync",
          "quoteCount": 1,
          "fixedCount": 2,
          "matchedCount": 1,
          "quoteOnlyCount": 0,
          "fixedOnlyCount": 1,
          "assemblyToPartsCount": 0,
          "assemblyPartCount": 0,
          "aligned": [
            {
              "itemKey": "G281-XJ-06",
              "status": "matched",
              "quote": {
                "itemKey": "G281-XJ-06",
                "partNumber": "G281-XJ-06",
                "partName": "橡胶件",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  13
                ],
                "functions": [],
                "remarks": [
                  "恒伟林/远信/博昊/天乐"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "恒伟林/远信/博昊/天乐"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_rubber"
              },
              "fixed": {
                "itemKey": "G281-XJ-06",
                "partNumber": "G281-XJ-06",
                "partName": "橡胶件",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  26
                ],
                "functions": [
                  "原G281-XJ-06"
                ],
                "remarks": [
                  "博昊"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "博昊"
                ],
                "sapNos": [],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_rubber"
              }
            },
            {
              "itemKey": "G281-XJ-09",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "G281-XJ-09",
                "partNumber": "G281-XJ-09",
                "partName": "橡胶件",
                "unit": "PCS",
                "quantity": 4,
                "rowNumbers": [
                  27
                ],
                "functions": [
                  "原G281-XJ-09"
                ],
                "remarks": [
                  "博昊"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "博昊"
                ],
                "sapNos": [],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_rubber"
              }
            }
          ]
        },
        {
          "key": "materials",
          "label": "其他物料",
          "section": "material",
          "quoteCount": 5,
          "fixedCount": 5,
          "matchedCount": 4,
          "quoteOnlyCount": 1,
          "fixedOnlyCount": 1,
          "assemblyToPartsCount": 0,
          "assemblyPartCount": 0,
          "aligned": [
            {
              "itemKey": "HS-125(2X)N20-30",
              "status": "quote_only",
              "quote": {
                "itemKey": "HS-125(2X)N20-30",
                "partNumber": "HS-125(2X)N20-30",
                "partName": "不带胶-热缩管",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  7
                ],
                "functions": [],
                "remarks": [
                  "深圳宏商/长春海达"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04030275"
                ],
                "suppliers": [
                  "深圳宏商/长春海达"
                ],
                "sapNos": [
                  "A04030275"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": null
            },
            {
              "itemKey": "SCS2165A016",
              "status": "matched",
              "quote": {
                "itemKey": "SCS2165A016",
                "partNumber": "SCS2165A016",
                "partName": "16OR橙色编织套管",
                "unit": "M",
                "quantity": 1,
                "rowNumbers": [
                  9
                ],
                "functions": [],
                "remarks": [
                  "骏鼎达/明鑫"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101476"
                ],
                "suppliers": [
                  "骏鼎达/明鑫"
                ],
                "sapNos": [
                  "A04101476"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "SCS2165A016",
                "partNumber": "SCS2165A016",
                "partName": "16OR橙色编织套管",
                "unit": "M",
                "quantity": 1.15,
                "rowNumbers": [
                  22
                ],
                "functions": [],
                "remarks": [
                  "骏鼎达"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101476"
                ],
                "suppliers": [
                  "骏鼎达"
                ],
                "sapNos": [
                  "A04101476"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "LY5016019-OR2",
              "status": "matched",
              "quote": {
                "itemKey": "LY5016019-OR2",
                "partNumber": "LY5016019-OR2",
                "partName": "橙色布基胶带",
                "unit": "M",
                "quantity": 4,
                "rowNumbers": [
                  10
                ],
                "functions": [],
                "remarks": [
                  "联益"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101159"
                ],
                "suppliers": [
                  "联益"
                ],
                "sapNos": [
                  "A04101159"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "LY5016019-OR2",
                "partNumber": "LY5016019-OR2",
                "partName": "橙色布基胶带",
                "unit": "M",
                "quantity": 4.6,
                "rowNumbers": [
                  23
                ],
                "functions": [],
                "remarks": [
                  "联益"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101159"
                ],
                "suppliers": [
                  "联益"
                ],
                "sapNos": [
                  "A04101159"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "111-00563",
              "status": "matched",
              "quote": {
                "itemKey": "111-00563",
                "partNumber": "111-00563",
                "partName": "扎带绳",
                "unit": "PCS",
                "quantity": 6,
                "rowNumbers": [
                  14
                ],
                "functions": [],
                "remarks": [
                  "上海众安/海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06010012"
                ],
                "suppliers": [
                  "上海众安/海尔曼太通"
                ],
                "sapNos": [
                  "A06010012"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "111-00563",
                "partNumber": "111-00563",
                "partName": "扎带绳",
                "unit": "PCS",
                "quantity": 6,
                "rowNumbers": [
                  28
                ],
                "functions": [],
                "remarks": [
                  "海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06010012"
                ],
                "suppliers": [
                  "海尔曼太通"
                ],
                "sapNos": [
                  "A06010012"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "X1-BQ-01标签140X30MM",
              "status": "matched",
              "quote": {
                "itemKey": "X1-BQ-01标签140X30MM",
                "partNumber": "X1-BQ-01 标签140x30mm",
                "partName": "产品标签",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  15
                ],
                "functions": [],
                "remarks": [
                  "洪众"
                ],
                "otherRemarks": [],
                "wireNos": [
                  "70002326"
                ],
                "suppliers": [
                  "洪众"
                ],
                "sapNos": [
                  "70002326"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "X1-BQ-01标签140X30MM",
                "partNumber": "X1-BQ-01 标签140x30mm",
                "partName": "产品标签",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  29
                ],
                "functions": [],
                "remarks": [
                  "洪众"
                ],
                "otherRemarks": [],
                "wireNos": [
                  "70002326"
                ],
                "suppliers": [
                  "洪众"
                ],
                "sapNos": [
                  "70002326"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "HS-125(3X)18-30",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "HS-125(3X)18-30",
                "partNumber": "HS-125(3X) 18-30",
                "partName": "不带胶-热缩管",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  20
                ],
                "functions": [],
                "remarks": [
                  "长春海达"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04102622"
                ],
                "suppliers": [
                  "长春海达"
                ],
                "sapNos": [
                  "A04102622"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            }
          ]
        }
      ]
    },
    "6608491524": {
      "harnessId": "6608491524",
      "harnessName": "直流母线总成",
      "quoteSheet": "6608491524",
      "fixedSheet": "6608491524-35方",
      "sources": {
        "quote": {
          "sheet": "6608491524",
          "itemCount": 11
        },
        "fixed": {
          "sheet": "6608491524-35方",
          "itemCount": 25
        }
      },
      "summary": {
        "groupCount": 6,
        "connectorGroupCount": 2,
        "syncGroupCount": 2,
        "quoteItemCount": 11,
        "fixedItemCount": 25,
        "matchedCount": 7,
        "quoteOnlyCount": 2,
        "fixedOnlyCount": 3,
        "assemblyToPartsCount": 2,
        "assemblyPartCount": 15,
        "wireMatchedCount": 0,
        "syncMatchedCount": 3,
        "materialMatchedCount": 7
      },
      "groups": [
        {
          "key": "battery_end",
          "label": "接电池端",
          "section": "connector",
          "quoteCount": 1,
          "fixedCount": 8,
          "matchedCount": 0,
          "quoteOnlyCount": 0,
          "fixedOnlyCount": 0,
          "assemblyToPartsCount": 1,
          "assemblyPartCount": 8,
          "aligned": [
            {
              "itemKey": "HVPC2P1600FV550-NH-P010",
              "status": "assembly_to_parts",
              "mappingType": "assembly_to_parts",
              "quote": {
                "itemKey": "HVPC2P1600FV550-NH-P010",
                "partNumber": "HVPC2P1600FV550-NH-P010",
                "partName": "连接器总成",
                "unit": "SET",
                "quantity": 1,
                "rowNumbers": [
                  5
                ],
                "functions": [
                  "接电池端"
                ],
                "remarks": [
                  "安费诺"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "安费诺"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [
                  "HVPC2P1600FV550-NH-P010"
                ],
                "kind": "connector",
                "groupKey": "battery_end"
              },
              "fixed": null,
              "fixedParts": [
                {
                  "itemKey": "HVPC2P1600FV5-NH-M-P010",
                  "partNumber": "HVPC2P1600FV5-NH-M-P010",
                  "partName": "护套-90度-反装-CODE A",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    5
                  ],
                  "functions": [
                    "接电池端"
                  ],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105143"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02105143"
                  ],
                  "assemblyRefs": [
                    "HVPC2P1600FV535-NH-P010 接电池端 适配2*35mm²屏蔽铜包铝硅胶铝导线"
                  ],
                  "kind": "connector",
                  "groupKey": "battery_end"
                },
                {
                  "itemKey": "HVPC2P1600FV-09-P010",
                  "partNumber": "HVPC2P1600FV-09-P010",
                  "partName": "焊接端子-镀银",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    6
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03103438"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A03103438"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "battery_end"
                },
                {
                  "itemKey": "HVPC2P1600FV-15P010",
                  "partNumber": "HVPC2P1600FV-15P010",
                  "partName": "挡板_黑色",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    7
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02104375"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02104375"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "battery_end"
                },
                {
                  "itemKey": "HVPC2P1600FV-06-35P010",
                  "partNumber": "HVPC2P1600FV-06-35P010",
                  "partName": "外屏蔽环",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    8
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03103387"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A03103387"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "battery_end"
                },
                {
                  "itemKey": "HVPC2P1800FS-11-25G-P010",
                  "partNumber": "HVPC2P1800FS-11-25G-P010",
                  "partName": "内屏蔽环",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    9
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03103437"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A03103437"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "battery_end"
                },
                {
                  "itemKey": "HVPC2P1600FV-12-35P010",
                  "partNumber": "HVPC2P1600FV-12-35P010",
                  "partName": "密封圈-黑色",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    10
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105020"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02105020"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "battery_end"
                },
                {
                  "itemKey": "HVPC2P1600FV-11-35P010",
                  "partNumber": "HVPC2P1600FV-11-35P010",
                  "partName": "线卡-黑色",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    11
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105018"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02105018"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "battery_end"
                },
                {
                  "itemKey": "HVPC2P1600FV-10-35P010",
                  "partNumber": "HVPC2P1600FV-10-35P010",
                  "partName": "尾盖-橙色",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    12
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105019"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02105019"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "battery_end"
                }
              ]
            }
          ]
        },
        {
          "key": "edrive_end",
          "label": "接电驱端",
          "section": "connector",
          "quoteCount": 1,
          "fixedCount": 7,
          "matchedCount": 0,
          "quoteOnlyCount": 0,
          "fixedOnlyCount": 0,
          "assemblyToPartsCount": 1,
          "assemblyPartCount": 7,
          "aligned": [
            {
              "itemKey": "IPT2PFS050-S02P010",
              "status": "assembly_to_parts",
              "mappingType": "assembly_to_parts",
              "quote": {
                "itemKey": "IPT2PFS050-S02P010",
                "partNumber": "IPT2PFS050-S02P010",
                "partName": "IPT连接器总成（带焊接端子）",
                "unit": "SET",
                "quantity": 1,
                "rowNumbers": [
                  6
                ],
                "functions": [
                  "接电驱"
                ],
                "remarks": [
                  "安费诺"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "安费诺"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [
                  "IPT2PFS050-S02P010"
                ],
                "kind": "connector",
                "groupKey": "edrive_end"
              },
              "fixed": null,
              "fixedParts": [
                {
                  "itemKey": "N022525276C",
                  "partNumber": "N022525276C",
                  "partName": "焊接端子-70",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    13
                  ],
                  "functions": [
                    "接电驱端"
                  ],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03103440"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A03103440"
                  ],
                  "assemblyRefs": [
                    "IPT2PFS035-S02P010（安费诺） 接电驱端 适配2*35mm²屏蔽铜包铝硅胶铝导线"
                  ],
                  "kind": "connector",
                  "groupKey": "edrive_end"
                },
                {
                  "itemKey": "IPT2PFS035-GA-01P010",
                  "partNumber": "IPT2PFS035-GA-01P010",
                  "partName": "主体组合件",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    14
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02102660"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02102660"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "edrive_end"
                },
                {
                  "itemKey": "IPT2PFS-S01-35P010",
                  "partNumber": "IPT2PFS-S01-35P010",
                  "partName": "压接屏蔽内环-35",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    15
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03101954"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A03101954"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "edrive_end"
                },
                {
                  "itemKey": "IPT2PFS-S02-35P010",
                  "partNumber": "IPT2PFS-S02-35P010",
                  "partName": "压接屏蔽外环-35/50",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    16
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03101953"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A03101953"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "edrive_end"
                },
                {
                  "itemKey": "IPT2PFS-M04-35P010",
                  "partNumber": "IPT2PFS-M04-35P010",
                  "partName": "屏蔽固定件-16/25/35",
                  "unit": "PCS",
                  "quantity": 4,
                  "rowNumbers": [
                    17
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02102662"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02102662"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "edrive_end"
                },
                {
                  "itemKey": "IPT2PFS-R02-35P010",
                  "partNumber": "IPT2PFS-R02-35P010",
                  "partName": "密封圈-35",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    18
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02102663"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02102663"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "edrive_end"
                },
                {
                  "itemKey": "IPT2PFS-M05-35P010",
                  "partNumber": "IPT2PFS-M05-35P010",
                  "partName": "尾盖-35",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    19
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105144"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02105144"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "edrive_end"
                }
              ]
            }
          ]
        },
        {
          "key": "wires",
          "label": "导线",
          "section": "wire",
          "quoteCount": 1,
          "fixedCount": 1,
          "matchedCount": 0,
          "quoteOnlyCount": 1,
          "fixedOnlyCount": 1,
          "assemblyToPartsCount": 0,
          "assemblyPartCount": 0,
          "aligned": [
            {
              "itemKey": "FHLALR2GCCAATB2G/50.0/橙",
              "status": "quote_only",
              "quote": {
                "itemKey": "FHLALR2GCCAATB2G/50.0/橙",
                "partNumber": "FHLALR2GCCAATB2G/50.0/橙",
                "partName": "50mm²屏蔽镀锡铜包铝硅胶铝导线",
                "unit": "M",
                "quantity": 1.37,
                "rowNumbers": [
                  8
                ],
                "functions": [],
                "remarks": [
                  "太平洋/鑫宏业"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "太平洋/鑫宏业"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              },
              "fixed": null
            },
            {
              "itemKey": "FHLALR2GCCAATB2G/35.0/橙",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "FHLALR2GCCAATB2G/35.0/橙",
                "partNumber": "FHLALR2GCCAATB2G/35.0/橙",
                "partName": "35mm²屏蔽镀锡铜包铝硅胶铝导线",
                "unit": "M",
                "quantity": 1.41,
                "rowNumbers": [
                  21
                ],
                "functions": [],
                "remarks": [
                  "太平洋"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01103420"
                ],
                "suppliers": [
                  "太平洋"
                ],
                "sapNos": [
                  "A01103420"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            }
          ]
        },
        {
          "key": "sync_brackets",
          "label": "支架类（同步开发件）",
          "section": "sync",
          "quoteCount": 2,
          "fixedCount": 2,
          "matchedCount": 2,
          "quoteOnlyCount": 0,
          "fixedOnlyCount": 0,
          "assemblyToPartsCount": 0,
          "assemblyPartCount": 0,
          "aligned": [
            {
              "itemKey": "G281-HB-03",
              "status": "matched",
              "quote": {
                "itemKey": "G281-HB-03",
                "partNumber": "G281-HB-03",
                "partName": "塑料支架",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  11
                ],
                "functions": [],
                "remarks": [
                  "博昊/天久/华凯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "博昊/天久/华凯"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              },
              "fixed": {
                "itemKey": "G281-HB-03",
                "partNumber": "G281-HB-03",
                "partName": "塑料支架（带2个衬套）",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  24
                ],
                "functions": [],
                "remarks": [
                  "上海程达"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06102157"
                ],
                "suppliers": [
                  "上海程达"
                ],
                "sapNos": [
                  "A06102157"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              }
            },
            {
              "itemKey": "G281-ZJ-06",
              "status": "matched",
              "quote": {
                "itemKey": "G281-ZJ-06",
                "partNumber": "G281-ZJ-06",
                "partName": "金属支架",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  12
                ],
                "functions": [],
                "remarks": [
                  "恒伟林/贵龙/华凯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "恒伟林/贵龙/华凯"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              },
              "fixed": {
                "itemKey": "G281-ZJ-06",
                "partNumber": "G281-ZJ-06",
                "partName": "金属支架",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  25
                ],
                "functions": [],
                "remarks": [
                  "华凯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06102146"
                ],
                "suppliers": [
                  "华凯"
                ],
                "sapNos": [
                  "A06102146"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              }
            }
          ]
        },
        {
          "key": "sync_rubber",
          "label": "橡胶件类（同步开发件）",
          "section": "sync",
          "quoteCount": 1,
          "fixedCount": 2,
          "matchedCount": 1,
          "quoteOnlyCount": 0,
          "fixedOnlyCount": 1,
          "assemblyToPartsCount": 0,
          "assemblyPartCount": 0,
          "aligned": [
            {
              "itemKey": "G281-XJ-06",
              "status": "matched",
              "quote": {
                "itemKey": "G281-XJ-06",
                "partNumber": "G281-XJ-06",
                "partName": "橡胶件",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  13
                ],
                "functions": [],
                "remarks": [
                  "恒伟林/远信/博昊/天乐"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "恒伟林/远信/博昊/天乐"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_rubber"
              },
              "fixed": {
                "itemKey": "G281-XJ-06",
                "partNumber": "G281-XJ-06",
                "partName": "橡胶件",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  26
                ],
                "functions": [
                  "原G281-XJ-06"
                ],
                "remarks": [
                  "博昊"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "博昊"
                ],
                "sapNos": [],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_rubber"
              }
            },
            {
              "itemKey": "G281-XJ-09",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "G281-XJ-09",
                "partNumber": "G281-XJ-09",
                "partName": "橡胶件",
                "unit": "PCS",
                "quantity": 4,
                "rowNumbers": [
                  27
                ],
                "functions": [
                  "原G281-XJ-09"
                ],
                "remarks": [
                  "博昊"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "博昊"
                ],
                "sapNos": [],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_rubber"
              }
            }
          ]
        },
        {
          "key": "materials",
          "label": "其他物料",
          "section": "material",
          "quoteCount": 5,
          "fixedCount": 5,
          "matchedCount": 4,
          "quoteOnlyCount": 1,
          "fixedOnlyCount": 1,
          "assemblyToPartsCount": 0,
          "assemblyPartCount": 0,
          "aligned": [
            {
              "itemKey": "HS-125(2X)N20-30",
              "status": "quote_only",
              "quote": {
                "itemKey": "HS-125(2X)N20-30",
                "partNumber": "HS-125(2X)N20-30",
                "partName": "不带胶-热缩管",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  7
                ],
                "functions": [],
                "remarks": [
                  "深圳宏商/长春海达"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04030275"
                ],
                "suppliers": [
                  "深圳宏商/长春海达"
                ],
                "sapNos": [
                  "A04030275"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": null
            },
            {
              "itemKey": "SCS2165A016",
              "status": "matched",
              "quote": {
                "itemKey": "SCS2165A016",
                "partNumber": "SCS2165A016",
                "partName": "16OR橙色编织套管",
                "unit": "M",
                "quantity": 0.85,
                "rowNumbers": [
                  9
                ],
                "functions": [],
                "remarks": [
                  "骏鼎达/明鑫"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101476"
                ],
                "suppliers": [
                  "骏鼎达/明鑫"
                ],
                "sapNos": [
                  "A04101476"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "SCS2165A016",
                "partNumber": "SCS2165A016",
                "partName": "16OR橙色编织套管",
                "unit": "M",
                "quantity": 0.97,
                "rowNumbers": [
                  22
                ],
                "functions": [],
                "remarks": [
                  "骏鼎达"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101476"
                ],
                "suppliers": [
                  "骏鼎达"
                ],
                "sapNos": [
                  "A04101476"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "LY5016019-OR2",
              "status": "matched",
              "quote": {
                "itemKey": "LY5016019-OR2",
                "partNumber": "LY5016019-OR2",
                "partName": "橙色布基胶带",
                "unit": "M",
                "quantity": 4,
                "rowNumbers": [
                  10
                ],
                "functions": [],
                "remarks": [
                  "联益"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101159"
                ],
                "suppliers": [
                  "联益"
                ],
                "sapNos": [
                  "A04101159"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "LY5016019-OR2",
                "partNumber": "LY5016019-OR2",
                "partName": "橙色布基胶带",
                "unit": "M",
                "quantity": 4.6,
                "rowNumbers": [
                  23
                ],
                "functions": [],
                "remarks": [
                  "联益"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101159"
                ],
                "suppliers": [
                  "联益"
                ],
                "sapNos": [
                  "A04101159"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "111-00563",
              "status": "matched",
              "quote": {
                "itemKey": "111-00563",
                "partNumber": "111-00563",
                "partName": "扎带绳",
                "unit": "PCS",
                "quantity": 6,
                "rowNumbers": [
                  14
                ],
                "functions": [],
                "remarks": [
                  "上海众安/海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06010012"
                ],
                "suppliers": [
                  "上海众安/海尔曼太通"
                ],
                "sapNos": [
                  "A06010012"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "111-00563",
                "partNumber": "111-00563",
                "partName": "扎带绳",
                "unit": "PCS",
                "quantity": 6,
                "rowNumbers": [
                  28
                ],
                "functions": [],
                "remarks": [
                  "海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06010012"
                ],
                "suppliers": [
                  "海尔曼太通"
                ],
                "sapNos": [
                  "A06010012"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "X1-BQ-01标签140X30MM",
              "status": "matched",
              "quote": {
                "itemKey": "X1-BQ-01标签140X30MM",
                "partNumber": "X1-BQ-01 标签140x30mm",
                "partName": "产品标签",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  15
                ],
                "functions": [],
                "remarks": [
                  "洪众"
                ],
                "otherRemarks": [],
                "wireNos": [
                  "70002326"
                ],
                "suppliers": [
                  "洪众"
                ],
                "sapNos": [
                  "70002326"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "X1-BQ-01标签140X30MM",
                "partNumber": "X1-BQ-01 标签140x30mm",
                "partName": "产品标签",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  29
                ],
                "functions": [],
                "remarks": [
                  "洪众"
                ],
                "otherRemarks": [],
                "wireNos": [
                  "70002326"
                ],
                "suppliers": [
                  "洪众"
                ],
                "sapNos": [
                  "70002326"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "HS-125(3X)18-30",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "HS-125(3X)18-30",
                "partNumber": "HS-125(3X) 18-30",
                "partName": "不带胶-热缩管",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  20
                ],
                "functions": [],
                "remarks": [
                  "长春海达"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04102622"
                ],
                "suppliers": [
                  "长春海达"
                ],
                "sapNos": [
                  "A04102622"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            }
          ]
        }
      ]
    },
    "6608507680": {
      "harnessId": "6608507680",
      "harnessName": "组合式充电插座线束总成",
      "quoteSheet": "6608507680",
      "fixedSheet": "6608507680",
      "sources": {
        "quote": {
          "sheet": "6608507680",
          "itemCount": 48
        },
        "fixed": {
          "sheet": "6608507680",
          "itemCount": 100
        }
      },
      "summary": {
        "groupCount": 11,
        "connectorGroupCount": 7,
        "syncGroupCount": 2,
        "quoteItemCount": 48,
        "fixedItemCount": 97,
        "matchedCount": 28,
        "quoteOnlyCount": 15,
        "fixedOnlyCount": 39,
        "assemblyToPartsCount": 5,
        "assemblyPartCount": 30,
        "wireMatchedCount": 4,
        "syncMatchedCount": 10,
        "materialMatchedCount": 21
      },
      "groups": [
        {
          "key": "charge_socket",
          "label": "充电插座",
          "section": "connector",
          "quoteCount": 1,
          "fixedCount": 15,
          "matchedCount": 0,
          "quoteOnlyCount": 0,
          "fixedOnlyCount": 0,
          "assemblyToPartsCount": 1,
          "assemblyPartCount": 15,
          "aligned": [
            {
              "itemKey": "2523328-1",
              "status": "assembly_to_parts",
              "mappingType": "assembly_to_parts",
              "quote": {
                "itemKey": "2523328-1",
                "partNumber": "2523328-1",
                "partName": "组合式充电插座(带防尘盖)",
                "unit": "SET",
                "quantity": 1,
                "rowNumbers": [
                  5
                ],
                "functions": [
                  "组合式充电插座(带电子锁，防尘盖)"
                ],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [
                  "2523328-1"
                ],
                "kind": "connector",
                "groupKey": "charge_socket"
              },
              "fixed": null,
              "fixedParts": [
                {
                  "itemKey": "2519063-1",
                  "partNumber": "2519063-1",
                  "partName": "防尘盖组件",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    5
                  ],
                  "functions": [
                    "组合式充电插座(带电子锁，防尘盖)"
                  ],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105132"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A02105132"
                  ],
                  "assemblyRefs": [
                    "2523328-1 组合式充电插座(带电子锁，防尘盖) DC：120mm²非屏蔽硅胶铝导线 AC：6mm²非屏蔽铝导线 DC接地：6mm²非屏蔽黄绿铜导线 AC接地：5mm²非屏蔽黄绿铜导线"
                  ],
                  "kind": "connector",
                  "groupKey": "charge_socket"
                },
                {
                  "itemKey": "2521766-1",
                  "partNumber": "2521766-1",
                  "partName": "直流壳体组件",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    7
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A05100637"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A05100637"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "charge_socket"
                },
                {
                  "itemKey": "2495482-6",
                  "partNumber": "2495482-6",
                  "partName": "DC-焊接端子组件",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    8
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03103436"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A03103436"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "charge_socket"
                },
                {
                  "itemKey": "2521057-1",
                  "partNumber": "2521057-1",
                  "partName": "DC-PE-压接端子",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    9
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A05100556"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A05100556"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "charge_socket"
                },
                {
                  "itemKey": "2411162-9",
                  "partNumber": "2411162-9",
                  "partName": "密封圈-DC-焊接端子",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    10
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02104529"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A02104529"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "charge_socket"
                },
                {
                  "itemKey": "2403723-6",
                  "partNumber": "2403723-6",
                  "partName": "PE线密封圈",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    11
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02104531"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A02104531"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "charge_socket"
                },
                {
                  "itemKey": "2403722-7",
                  "partNumber": "2403722-7",
                  "partName": "PE尾盖",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    12
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02104533"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A02104533"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "charge_socket"
                },
                {
                  "itemKey": "2406408-1",
                  "partNumber": "2406408-1",
                  "partName": "DC线密封圈",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    13
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105133"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A02105133"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "charge_socket"
                },
                {
                  "itemKey": "2406406-1",
                  "partNumber": "2406406-1",
                  "partName": "DC尾盖",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    14
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105131"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A02105131"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "charge_socket"
                },
                {
                  "itemKey": "2517495-1",
                  "partNumber": "2517495-1",
                  "partName": "交流壳体组件",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    15
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A05100636"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A05100636"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "charge_socket"
                },
                {
                  "itemKey": "2519345-1",
                  "partNumber": "2519345-1",
                  "partName": "AC+AC-PE焊接端子",
                  "unit": "PCS",
                  "quantity": 3,
                  "rowNumbers": [
                    16
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03103175"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A03103175"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "charge_socket"
                },
                {
                  "itemKey": "2500438-1",
                  "partNumber": "2500438-1",
                  "partName": "密封圈-AC+AC-PE焊接端子",
                  "unit": "PCS",
                  "quantity": 3,
                  "rowNumbers": [
                    17
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02104528"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A02104528"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "charge_socket"
                },
                {
                  "itemKey": "2499861-1",
                  "partNumber": "2499861-1",
                  "partName": "AC+PE尾盖",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    18
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A05100560"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A05100560"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "charge_socket"
                },
                {
                  "itemKey": "2483376-2",
                  "partNumber": "2483376-2",
                  "partName": "电子锁",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    19
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A05100635"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A05100635"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "charge_socket"
                },
                {
                  "itemKey": "2518993-4",
                  "partNumber": "2518993-4",
                  "partName": "电子锁拉绳",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    20
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A05100634"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A05100634"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "charge_socket"
                }
              ]
            }
          ]
        },
        {
          "key": "dc_charge_end",
          "label": "快充端",
          "section": "connector",
          "quoteCount": 2,
          "fixedCount": 7,
          "matchedCount": 1,
          "quoteOnlyCount": 0,
          "fixedOnlyCount": 0,
          "assemblyToPartsCount": 1,
          "assemblyPartCount": 6,
          "aligned": [
            {
              "itemKey": "1-2438787-1",
              "status": "matched",
              "quote": {
                "itemKey": "1-2438787-1",
                "partNumber": "1-2438787-1",
                "partName": "低压连接器总成（10PIN，10个端子，10个防水栓）",
                "unit": "SET",
                "quantity": 1,
                "rowNumbers": [
                  7
                ],
                "functions": [
                  "DC 10PIN低压信号连接器"
                ],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [
                  "1-2438787-1"
                ],
                "kind": "connector",
                "groupKey": "dc_charge_end"
              },
              "fixed": {
                "itemKey": "1-2438787-1",
                "partNumber": "1-2438787-1",
                "partName": "DC端低压插件-8pin",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  23
                ],
                "functions": [
                  "DC 8PIN低压信号连接器"
                ],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02100365"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "A02100365"
                ],
                "assemblyRefs": [
                  "1-2438787-1 DC 8PIN低压信号连接器 适配8*0.5mm²线"
                ],
                "kind": "connector",
                "groupKey": "dc_charge_end"
              }
            },
            {
              "itemKey": "HVSPC2P1900FS112",
              "status": "assembly_to_parts",
              "mappingType": "assembly_to_parts",
              "quote": {
                "itemKey": "HVSPC2P1900FS112",
                "partNumber": "HVSPC2P1900FS112",
                "partName": "ODP端连接器（直流）",
                "unit": "SET",
                "quantity": 1,
                "rowNumbers": [
                  13
                ],
                "functions": [
                  "快充连接器（直流）"
                ],
                "remarks": [
                  "安费诺"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "安费诺"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [
                  "HVSPC2P1900FS112"
                ],
                "kind": "connector",
                "groupKey": "dc_charge_end"
              },
              "fixed": null,
              "fixedParts": [
                {
                  "itemKey": "7-2435189-1",
                  "partNumber": "7-2435189-1",
                  "partName": "低压线端子-链式压接",
                  "unit": "PCS",
                  "quantity": 13,
                  "rowNumbers": [
                    24,
                    27
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03033043"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A03033043"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "dc_charge_end"
                },
                {
                  "itemKey": "5-2435022-1",
                  "partNumber": "5-2435022-1",
                  "partName": "低压线防水栓",
                  "unit": "PCS",
                  "quantity": 17,
                  "rowNumbers": [
                    25,
                    28,
                    32
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03100681"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A03100681"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "dc_charge_end"
                },
                {
                  "itemKey": "HVSPC2P1900FS1-M",
                  "partNumber": "HVSPC2P1900FS1-M",
                  "partName": "护套-正插Code A0-180度",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    41
                  ],
                  "functions": [
                    "快充连接器（直流）"
                  ],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105129"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02105129"
                  ],
                  "assemblyRefs": [
                    "HVSPC2P1900FS112 快充连接器（直流） 适配2*120mm²非屏蔽硅胶铝导线 ESOW：HVSPC2P1900FS112（安费诺，120方非屏蔽、CodeA、带互锁、180°正插） 3D数据：Code A0 180度 安费诺提供资料：180度"
                  ],
                  "kind": "connector",
                  "groupKey": "dc_charge_end"
                },
                {
                  "itemKey": "HVPC2P1900FS-05",
                  "partNumber": "HVPC2P1900FS-05",
                  "partName": "端子",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    42
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03103435"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A03103435"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "dc_charge_end"
                },
                {
                  "itemKey": "HVPC2P1900FV-08",
                  "partNumber": "HVPC2P1900FV-08",
                  "partName": "密封圈挡板",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    43
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02104536"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02104536"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "dc_charge_end"
                },
                {
                  "itemKey": "HVPC2P1900FV-0985",
                  "partNumber": "HVPC2P1900FV-0985",
                  "partName": "120mm²密封圈",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    44
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105127"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02105127"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "dc_charge_end"
                }
              ]
            }
          ]
        },
        {
          "key": "ac_charge_end",
          "label": "慢充端",
          "section": "connector",
          "quoteCount": 2,
          "fixedCount": 6,
          "matchedCount": 0,
          "quoteOnlyCount": 0,
          "fixedOnlyCount": 0,
          "assemblyToPartsCount": 2,
          "assemblyPartCount": 6,
          "aligned": [
            {
              "itemKey": "1-2355517-1",
              "status": "assembly_to_parts",
              "mappingType": "assembly_to_parts",
              "quote": {
                "itemKey": "1-2355517-1",
                "partNumber": "1-2355517-1",
                "partName": "低压连接器总成（5PIN，5个端子，5个防水栓）",
                "unit": "SET",
                "quantity": 1,
                "rowNumbers": [
                  6
                ],
                "functions": [
                  "AC 5PIN低压信号连接器"
                ],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [
                  "1-2355517-1"
                ],
                "kind": "connector",
                "groupKey": "ac_charge_end"
              },
              "fixed": null,
              "fixedParts": [
                {
                  "itemKey": "1-2355517-5",
                  "partNumber": "1-2355517-5",
                  "partName": "AC端低压插件-5pin",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    26
                  ],
                  "functions": [
                    "AC 6PIN低压信号连接器,"
                  ],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02034551"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A02034551"
                  ],
                  "assemblyRefs": [
                    "1-2355517-5 AC 6PIN低压信号连接器, 6#不使用 适配5*0.5方单芯铜导线"
                  ],
                  "kind": "connector",
                  "groupKey": "ac_charge_end"
                }
              ]
            },
            {
              "itemKey": "HVC2PG263UFSW106-NH",
              "status": "assembly_to_parts",
              "mappingType": "assembly_to_parts",
              "quote": {
                "itemKey": "HVC2PG263UFSW106-NH",
                "partNumber": "HVC2PG263UFSW106-NH",
                "partName": "ODP端连接器（交流）",
                "unit": "SET",
                "quantity": 1,
                "rowNumbers": [
                  14
                ],
                "functions": [
                  "慢充端连接器（交流）"
                ],
                "remarks": [
                  "安费诺"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "安费诺"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [
                  "HVC2PG263UFSW106-NH"
                ],
                "kind": "connector",
                "groupKey": "ac_charge_end"
              },
              "fixed": null,
              "fixedParts": [
                {
                  "itemKey": "HVC2PG263FSW1-M-NH-P010",
                  "partNumber": "HVC2PG263FSW1-M-NH-P010",
                  "partName": "插头组件Code A 无高压互锁",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    47
                  ],
                  "functions": [
                    "慢充连接器（交流）"
                  ],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02104803"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02104803"
                  ],
                  "assemblyRefs": [
                    "HVC2PG263UFSW106-NH 慢充连接器（交流） 适配2*6mm²非屏蔽铝导线 （安费诺，取消互锁，工具解锁，6方非屏蔽铝线，超声波焊接）"
                  ],
                  "kind": "connector",
                  "groupKey": "ac_charge_end"
                },
                {
                  "itemKey": "N022525343C-P010",
                  "partNumber": "N022525343C-P010",
                  "partName": "6.3母端子(2.5-6mm²)",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    48
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03101971"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A03101971"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "ac_charge_end"
                },
                {
                  "itemKey": "HVC2P63FS-10-0902-P010",
                  "partNumber": "HVC2P63FS-10-0902-P010",
                  "partName": "HVC2P63-02线束密封圈 白色",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    49
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105128"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02105128"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "ac_charge_end"
                },
                {
                  "itemKey": "HVC2P63UFS-21-0306-P010",
                  "partNumber": "HVC2P63UFS-21-0306-P010",
                  "partName": "HVC2P63插头06非屏蔽线卡 紫色",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    50
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105123"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02105123"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "ac_charge_end"
                },
                {
                  "itemKey": "HVC2P63UFS-22-0306-P010",
                  "partNumber": "HVC2P63UFS-22-0306-P010",
                  "partName": "HVC2P63插头06非屏蔽后盖 紫色",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    51
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105126"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02105126"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "ac_charge_end"
                }
              ]
            }
          ]
        },
        {
          "key": "electronic_lock",
          "label": "电子锁",
          "section": "connector",
          "quoteCount": 2,
          "fixedCount": 3,
          "matchedCount": 0,
          "quoteOnlyCount": 1,
          "fixedOnlyCount": 0,
          "assemblyToPartsCount": 1,
          "assemblyPartCount": 3,
          "aligned": [
            {
              "itemKey": "805-122-541",
              "status": "assembly_to_parts",
              "mappingType": "assembly_to_parts",
              "quote": {
                "itemKey": "805-122-541",
                "partNumber": "805-122-541",
                "partName": "护套",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  15
                ],
                "functions": [
                  "电子锁低压连接器总成"
                ],
                "remarks": [
                  "赫尔斯曼"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02000642"
                ],
                "suppliers": [
                  "赫尔斯曼"
                ],
                "sapNos": [
                  "A02000642"
                ],
                "assemblyRefs": [
                  "805-122-541"
                ],
                "kind": "connector",
                "groupKey": "electronic_lock"
              },
              "fixed": null,
              "fixedParts": [
                {
                  "itemKey": "2298159-1",
                  "partNumber": "2298159-1",
                  "partName": "电子锁低压插件-4pin",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    30
                  ],
                  "functions": [
                    "电子锁低压连接器总成"
                  ],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02033733"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A02033733"
                  ],
                  "assemblyRefs": [
                    "2298159-1 电子锁低压连接器总成 适配4*0.5mm²单芯铜导线"
                  ],
                  "kind": "connector",
                  "groupKey": "electronic_lock"
                },
                {
                  "itemKey": "5-965906-1",
                  "partNumber": "5-965906-1",
                  "partName": "电子锁低压端子-链式压接",
                  "unit": "PCS",
                  "quantity": 4,
                  "rowNumbers": [
                    31
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03030931"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A03030931"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "electronic_lock"
                },
                {
                  "itemKey": "10106502",
                  "partNumber": "10106502",
                  "partName": "带胶-热缩管",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    56
                  ],
                  "functions": [
                    "电子锁低压线并线焊接热缩"
                  ],
                  "remarks": [
                    "深圳宏商"
                  ],
                  "otherRemarks": [
                    "★"
                  ],
                  "wireNos": [
                    "A04032307"
                  ],
                  "suppliers": [
                    "深圳宏商"
                  ],
                  "sapNos": [
                    "A04032307"
                  ],
                  "assemblyRefs": [
                    "电子锁低压线并线焊接热缩"
                  ],
                  "kind": "connector",
                  "groupKey": "electronic_lock"
                }
              ]
            },
            {
              "itemKey": "32140734123",
              "status": "quote_only",
              "quote": {
                "itemKey": "32140734123",
                "partNumber": "32140734123",
                "partName": "端子",
                "unit": "PCS",
                "quantity": 4,
                "rowNumbers": [
                  16
                ],
                "functions": [],
                "remarks": [
                  "科世达"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A03032316"
                ],
                "suppliers": [
                  "科世达"
                ],
                "sapNos": [
                  "A03032316"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "electronic_lock"
              },
              "fixed": null
            }
          ]
        },
        {
          "key": "low_voltage_inline",
          "label": "低压连接器",
          "section": "connector",
          "quoteCount": 2,
          "fixedCount": 7,
          "matchedCount": 2,
          "quoteOnlyCount": 0,
          "fixedOnlyCount": 5,
          "assemblyToPartsCount": 0,
          "assemblyPartCount": 0,
          "aligned": [
            {
              "itemKey": "5-2385463-1",
              "status": "matched",
              "quote": {
                "itemKey": "5-2385463-1",
                "partNumber": "5-2385463-1",
                "partName": "护套塑壳",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  8
                ],
                "functions": [
                  "低压连接器总成"
                ],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02101947"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "A02101947"
                ],
                "assemblyRefs": [
                  "5-2385463-1"
                ],
                "kind": "connector",
                "groupKey": "low_voltage_inline"
              },
              "fixed": {
                "itemKey": "5-2385463-1",
                "partNumber": "5-2385463-1",
                "partName": "护套塑壳",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  33
                ],
                "functions": [
                  "低压inline连接器总成，22pin使用16pin"
                ],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02101947"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "A02101947"
                ],
                "assemblyRefs": [
                  "5-2385463-1 低压inline连接器总成，22pin使用16pin 4#8#13#15#16#22#不使用 适配16*0.5mm²单芯铜导线"
                ],
                "kind": "connector",
                "groupKey": "low_voltage_inline"
              }
            },
            {
              "itemKey": "2377023-2",
              "status": "matched",
              "quote": {
                "itemKey": "2377023-2",
                "partNumber": "2377023-2",
                "partName": "端子",
                "unit": "PCS",
                "quantity": 18,
                "rowNumbers": [
                  9
                ],
                "functions": [],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A03033091"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "A03033091"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "low_voltage_inline"
              },
              "fixed": {
                "itemKey": "2377023-2",
                "partNumber": "2377023-2",
                "partName": "0.64型端子",
                "unit": "PCS",
                "quantity": 15,
                "rowNumbers": [
                  34
                ],
                "functions": [],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A03033091"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "A03033091"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "low_voltage_inline"
              }
            },
            {
              "itemKey": "2377789-2",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "2377789-2",
                "partNumber": "2377789-2",
                "partName": "1.2型端子",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  35
                ],
                "functions": [],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A03033363"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "A03033363"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "low_voltage_inline"
              }
            },
            {
              "itemKey": "2377665-4",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "2377665-4",
                "partNumber": "2377665-4",
                "partName": "防水栓（非1/8/15/22）-0.64型端子使用",
                "unit": "PCS",
                "quantity": 15,
                "rowNumbers": [
                  36
                ],
                "functions": [],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A03033097"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "A03033097"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "low_voltage_inline"
              }
            },
            {
              "itemKey": "963142-1",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "963142-1",
                "partNumber": "963142-1",
                "partName": "防水栓（1/8/15/22）-1.2型端子使用",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  37
                ],
                "functions": [],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A03030849"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "A03030849"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "low_voltage_inline"
              }
            },
            {
              "itemKey": "2377665-3",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "2377665-3",
                "partNumber": "2377665-3",
                "partName": "盲栓（非1/8/15/22）-0.64型端子使用",
                "unit": "PCS",
                "quantity": 3,
                "rowNumbers": [
                  38
                ],
                "functions": [],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02034386"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "A02034386"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "low_voltage_inline"
              }
            },
            {
              "itemKey": "963143-1",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "963143-1",
                "partNumber": "963143-1",
                "partName": "盲栓（1/8/15/22）-1.2型端子使用",
                "unit": "PCS",
                "quantity": 3,
                "rowNumbers": [
                  39
                ],
                "functions": [],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02031363"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "A02031363"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "low_voltage_inline"
              }
            }
          ]
        },
        {
          "key": "dc_ground",
          "label": "DC 接地端子",
          "section": "connector",
          "quoteCount": 1,
          "fixedCount": 1,
          "matchedCount": 0,
          "quoteOnlyCount": 1,
          "fixedOnlyCount": 1,
          "assemblyToPartsCount": 0,
          "assemblyPartCount": 0,
          "aligned": [
            {
              "itemKey": "K03006773",
              "status": "quote_only",
              "quote": {
                "itemKey": "K03006773",
                "partNumber": "K03006773",
                "partName": "DC接地端子",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  18
                ],
                "functions": [
                  "DC接地端子"
                ],
                "remarks": [
                  "丰迪/荣盛达"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "丰迪/荣盛达"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "dc_ground"
              },
              "fixed": null
            },
            {
              "itemKey": "K03005541",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "K03005541",
                "partNumber": "K03005541",
                "partName": "DC接地端子",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  53
                ],
                "functions": [
                  "DC接地端子"
                ],
                "remarks": [
                  "丰迪"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A03101932"
                ],
                "suppliers": [
                  "丰迪"
                ],
                "sapNos": [
                  "A03101932"
                ],
                "assemblyRefs": [
                  "DC接地端子"
                ],
                "kind": "connector",
                "groupKey": "dc_ground"
              }
            }
          ]
        },
        {
          "key": "ac_ground",
          "label": "AC 接地端子",
          "section": "connector",
          "quoteCount": 1,
          "fixedCount": 1,
          "matchedCount": 0,
          "quoteOnlyCount": 1,
          "fixedOnlyCount": 1,
          "assemblyToPartsCount": 0,
          "assemblyPartCount": 0,
          "aligned": [
            {
              "itemKey": "K03005541",
              "status": "quote_only",
              "quote": {
                "itemKey": "K03005541",
                "partNumber": "K03005541",
                "partName": "AC接地端子",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  19
                ],
                "functions": [
                  "AC接地端子"
                ],
                "remarks": [
                  "丰迪/荣盛达"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A03101932"
                ],
                "suppliers": [
                  "丰迪/荣盛达"
                ],
                "sapNos": [
                  "A03101932"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "ac_ground"
              },
              "fixed": null
            },
            {
              "itemKey": "K03006773",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "K03006773",
                "partNumber": "K03006773",
                "partName": "AC接地端子",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  52
                ],
                "functions": [
                  "AC接地端子"
                ],
                "remarks": [
                  "丰迪"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A03103446"
                ],
                "suppliers": [
                  "丰迪"
                ],
                "sapNos": [
                  "A03103446"
                ],
                "assemblyRefs": [
                  "AC接地端子"
                ],
                "kind": "connector",
                "groupKey": "ac_ground"
              }
            }
          ]
        },
        {
          "key": "wires",
          "label": "导线",
          "section": "wire",
          "quoteCount": 5,
          "fixedCount": 20,
          "matchedCount": 4,
          "quoteOnlyCount": 1,
          "fixedOnlyCount": 16,
          "assemblyToPartsCount": 0,
          "assemblyPartCount": 0,
          "aligned": [
            {
              "itemKey": "FHLALR2G/120.0/橙",
              "status": "matched",
              "quote": {
                "itemKey": "FHLALR2G/120.0/橙",
                "partNumber": "FHLALR2G/120.0/橙",
                "partName": "120mm²单芯非屏蔽铝导线",
                "unit": "M",
                "quantity": 3.29,
                "rowNumbers": [
                  21
                ],
                "functions": [],
                "remarks": [
                  "太平洋/鑫宏业/斯普乐"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01101891"
                ],
                "suppliers": [
                  "太平洋/鑫宏业/斯普乐"
                ],
                "sapNos": [
                  "A01101891"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              },
              "fixed": {
                "itemKey": "FHLALR2G/120.0/橙",
                "partNumber": "FHLALR2G/120.0/橙",
                "partName": "120mm²单芯非屏蔽铝导线",
                "unit": "M",
                "quantity": 3.29,
                "rowNumbers": [
                  57
                ],
                "functions": [],
                "remarks": [
                  "鑫宏业"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01101891"
                ],
                "suppliers": [
                  "鑫宏业"
                ],
                "sapNos": [
                  "A01101891"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            },
            {
              "itemKey": "FHLALR91X/6.0/橙",
              "status": "quote_only",
              "quote": {
                "itemKey": "FHLALR91X/6.0/橙",
                "partNumber": "FHLALR91X/6.0/橙",
                "partName": "6mm²单芯非屏蔽铝导线",
                "unit": "M",
                "quantity": 2.86,
                "rowNumbers": [
                  22
                ],
                "functions": [],
                "remarks": [
                  "鑫宏业/斯普乐"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "鑫宏业/斯普乐"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              },
              "fixed": null
            },
            {
              "itemKey": "FHL91X/6.0/黄绿",
              "status": "matched",
              "quote": {
                "itemKey": "FHL91X/6.0/黄绿",
                "partNumber": "FHL91X/6.0/黄绿",
                "partName": "6mm²单芯铜导线",
                "unit": "M",
                "quantity": 0.23,
                "rowNumbers": [
                  23
                ],
                "functions": [],
                "remarks": [
                  "鑫宏业/斯普乐"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01101944"
                ],
                "suppliers": [
                  "鑫宏业/斯普乐"
                ],
                "sapNos": [
                  "A01101944"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              },
              "fixed": {
                "itemKey": "FHL91X/6.0/黄绿",
                "partNumber": "FHL91X/6.0/黄绿",
                "partName": "6mm²单芯铜导线",
                "unit": "M",
                "quantity": 0.23,
                "rowNumbers": [
                  59
                ],
                "functions": [],
                "remarks": [
                  "鑫宏业"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01102926"
                ],
                "suppliers": [
                  "鑫宏业"
                ],
                "sapNos": [
                  "A01102926"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            },
            {
              "itemKey": "FHL91X/5.0/黄绿",
              "status": "matched",
              "quote": {
                "itemKey": "FHL91X/5.0/黄绿",
                "partNumber": "FHL91X/5.0/黄绿",
                "partName": "5mm²单芯铜导线",
                "unit": "M",
                "quantity": 0.25,
                "rowNumbers": [
                  24
                ],
                "functions": [],
                "remarks": [
                  "鑫宏业/斯普乐"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "鑫宏业/斯普乐"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              },
              "fixed": {
                "itemKey": "FHL91X/5.0/黄绿",
                "partNumber": "FHL91X/5.0/黄绿",
                "partName": "5mm²单芯铜导线",
                "unit": "M",
                "quantity": 0.25,
                "rowNumbers": [
                  60
                ],
                "functions": [],
                "remarks": [
                  "鑫宏业"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01103405"
                ],
                "suppliers": [
                  "鑫宏业"
                ],
                "sapNos": [
                  "A01103405"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            },
            {
              "itemKey": "FLRY-B/0.5/黑",
              "status": "matched",
              "quote": {
                "itemKey": "FLRY-B/0.5/黑",
                "partNumber": "FLRY-B/0.5/黑",
                "partName": "低压导线",
                "unit": "M",
                "quantity": 9.9,
                "rowNumbers": [
                  25
                ],
                "functions": [],
                "remarks": [
                  "福斯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01011796"
                ],
                "suppliers": [
                  "福斯"
                ],
                "sapNos": [
                  "A01011796"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              },
              "fixed": {
                "itemKey": "FLRY-B/0.5/黑",
                "partNumber": "FLRY-B/0.5/黑",
                "partName": "0.5低压导线",
                "unit": "M",
                "quantity": 1,
                "rowNumbers": [
                  65
                ],
                "functions": [],
                "remarks": [
                  "福斯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01011796"
                ],
                "suppliers": [
                  "福斯"
                ],
                "sapNos": [
                  "A01011796"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            },
            {
              "itemKey": "FHLAL91X/6.0/橙/AL8",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "FHLAL91X/6.0/橙/AL8",
                "partNumber": "FHLAL91X/6.0/橙/AL8",
                "partName": "6mm²单芯非屏蔽铝导线",
                "unit": "M",
                "quantity": 2.86,
                "rowNumbers": [
                  58
                ],
                "functions": [],
                "remarks": [
                  "鑫宏业"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01103404"
                ],
                "suppliers": [
                  "鑫宏业"
                ],
                "sapNos": [
                  "A01103404"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            },
            {
              "itemKey": "FLRY-B/0.5/棕兰",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "FLRY-B/0.5/棕兰",
                "partNumber": "FLRY-B/0.5/棕兰",
                "partName": "0.5低压导线",
                "unit": "M",
                "quantity": 0.56,
                "rowNumbers": [
                  61
                ],
                "functions": [],
                "remarks": [
                  "福斯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01011830"
                ],
                "suppliers": [
                  "福斯"
                ],
                "sapNos": [
                  "A01011830"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            },
            {
              "itemKey": "FLRY-B/0.5/棕",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "FLRY-B/0.5/棕",
                "partNumber": "FLRY-B/0.5/棕",
                "partName": "0.5低压导线",
                "unit": "M",
                "quantity": 0.51,
                "rowNumbers": [
                  62
                ],
                "functions": [],
                "remarks": [
                  "福斯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01011832"
                ],
                "suppliers": [
                  "福斯"
                ],
                "sapNos": [
                  "A01011832"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            },
            {
              "itemKey": "FLRY-B/0.5/兰黄",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "FLRY-B/0.5/兰黄",
                "partNumber": "FLRY-B/0.5/兰黄",
                "partName": "0.5低压导线",
                "unit": "M",
                "quantity": 0.51,
                "rowNumbers": [
                  63
                ],
                "functions": [],
                "remarks": [
                  "福斯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01011805"
                ],
                "suppliers": [
                  "福斯"
                ],
                "sapNos": [
                  "A01011805"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            },
            {
              "itemKey": "FLRY-B/0.5/红",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "FLRY-B/0.5/红",
                "partNumber": "FLRY-B/0.5/红",
                "partName": "0.5低压导线",
                "unit": "M",
                "quantity": 0.51,
                "rowNumbers": [
                  64
                ],
                "functions": [],
                "remarks": [
                  "福斯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01011755"
                ],
                "suppliers": [
                  "福斯"
                ],
                "sapNos": [
                  "A01011755"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            },
            {
              "itemKey": "FLRY-B/0.5/兰",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "FLRY-B/0.5/兰",
                "partNumber": "FLRY-B/0.5/兰",
                "partName": "0.5低压导线",
                "unit": "M",
                "quantity": 0.51,
                "rowNumbers": [
                  66
                ],
                "functions": [],
                "remarks": [
                  "福斯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01011808"
                ],
                "suppliers": [
                  "福斯"
                ],
                "sapNos": [
                  "A01011808"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            },
            {
              "itemKey": "FLRY-B/0.5/黄黑",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "FLRY-B/0.5/黄黑",
                "partNumber": "FLRY-B/0.5/黄黑",
                "partName": "0.5低压导线",
                "unit": "M",
                "quantity": 0.56,
                "rowNumbers": [
                  67
                ],
                "functions": [],
                "remarks": [
                  "福斯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01011774"
                ],
                "suppliers": [
                  "福斯"
                ],
                "sapNos": [
                  "A01011774"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            },
            {
              "itemKey": "FLRY-B/0.5/白",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "FLRY-B/0.5/白",
                "partNumber": "FLRY-B/0.5/白",
                "partName": "0.5低压导线",
                "unit": "M",
                "quantity": 0.56,
                "rowNumbers": [
                  68
                ],
                "functions": [],
                "remarks": [
                  "福斯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01011749"
                ],
                "suppliers": [
                  "福斯"
                ],
                "sapNos": [
                  "A01011749"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            },
            {
              "itemKey": "FLRY-B/0.5/黄",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "FLRY-B/0.5/黄",
                "partNumber": "FLRY-B/0.5/黄",
                "partName": "0.5低压导线",
                "unit": "M",
                "quantity": 0.56,
                "rowNumbers": [
                  69
                ],
                "functions": [],
                "remarks": [
                  "福斯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01011771"
                ],
                "suppliers": [
                  "福斯"
                ],
                "sapNos": [
                  "A01011771"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            },
            {
              "itemKey": "FLRY-B/0.5/黑白",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "FLRY-B/0.5/黑白",
                "partNumber": "FLRY-B/0.5/黑白",
                "partName": "0.5低压导线",
                "unit": "M",
                "quantity": 0.56,
                "rowNumbers": [
                  70
                ],
                "functions": [],
                "remarks": [
                  "福斯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01011792"
                ],
                "suppliers": [
                  "福斯"
                ],
                "sapNos": [
                  "A01011792"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            },
            {
              "itemKey": "FLRY-B/0.5/黄白",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "FLRY-B/0.5/黄白",
                "partNumber": "FLRY-B/0.5/黄白",
                "partName": "0.5低压导线",
                "unit": "M",
                "quantity": 0.56,
                "rowNumbers": [
                  71
                ],
                "functions": [],
                "remarks": [
                  "福斯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01011769"
                ],
                "suppliers": [
                  "福斯"
                ],
                "sapNos": [
                  "A01011769"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            },
            {
              "itemKey": "FLRY-B/0.5/红白",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "FLRY-B/0.5/红白",
                "partNumber": "FLRY-B/0.5/红白",
                "partName": "0.5低压导线",
                "unit": "M",
                "quantity": 0.56,
                "rowNumbers": [
                  72
                ],
                "functions": [],
                "remarks": [
                  "福斯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01011754"
                ],
                "suppliers": [
                  "福斯"
                ],
                "sapNos": [
                  "A01011754"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            },
            {
              "itemKey": "FLRY-B/0.5/绿白",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "FLRY-B/0.5/绿白",
                "partNumber": "FLRY-B/0.5/绿白",
                "partName": "0.5低压导线",
                "unit": "M",
                "quantity": 0.56,
                "rowNumbers": [
                  73
                ],
                "functions": [],
                "remarks": [
                  "福斯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01011780"
                ],
                "suppliers": [
                  "福斯"
                ],
                "sapNos": [
                  "A01011780"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            },
            {
              "itemKey": "FLRY-B/0.5/绿黑",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "FLRY-B/0.5/绿黑",
                "partNumber": "FLRY-B/0.5/绿黑",
                "partName": "0.5低压导线",
                "unit": "M",
                "quantity": 0.51,
                "rowNumbers": [
                  74
                ],
                "functions": [],
                "remarks": [
                  "福斯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01011786"
                ],
                "suppliers": [
                  "福斯"
                ],
                "sapNos": [
                  "A01011786"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            },
            {
              "itemKey": "FLRY-B/0.5/粉",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "FLRY-B/0.5/粉",
                "partNumber": "FLRY-B/0.5/粉",
                "partName": "0.5低压导线",
                "unit": "M",
                "quantity": 0.51,
                "rowNumbers": [
                  75
                ],
                "functions": [],
                "remarks": [
                  "福斯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01000221"
                ],
                "suppliers": [
                  "福斯"
                ],
                "sapNos": [
                  "A01000221"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            },
            {
              "itemKey": "FLRY-B/0.5/紫白",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "FLRY-B/0.5/紫白",
                "partNumber": "FLRY-B/0.5/紫白",
                "partName": "0.5低压导线",
                "unit": "M",
                "quantity": 0.51,
                "rowNumbers": [
                  76
                ],
                "functions": [],
                "remarks": [
                  "福斯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01011813"
                ],
                "suppliers": [
                  "福斯"
                ],
                "sapNos": [
                  "A01011813"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            }
          ]
        },
        {
          "key": "sync_brackets",
          "label": "支架类（同步开发件）",
          "section": "sync",
          "quoteCount": 7,
          "fixedCount": 6,
          "matchedCount": 5,
          "quoteOnlyCount": 2,
          "fixedOnlyCount": 1,
          "assemblyToPartsCount": 0,
          "assemblyPartCount": 0,
          "aligned": [
            {
              "itemKey": "G281-HB-01",
              "status": "quote_only",
              "quote": {
                "itemKey": "G281-HB-01",
                "partNumber": "G281-HB-01",
                "partName": "塑料护板上盖",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  32
                ],
                "functions": [],
                "remarks": [
                  "博昊/天久/华凯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "博昊/天久/华凯"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              },
              "fixed": null
            },
            {
              "itemKey": "G281-HB-02",
              "status": "quote_only",
              "quote": {
                "itemKey": "G281-HB-02",
                "partNumber": "G281-HB-02",
                "partName": "塑料护板下盖",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  33
                ],
                "functions": [],
                "remarks": [
                  "博昊/天久/华凯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "博昊/天久/华凯"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              },
              "fixed": null
            },
            {
              "itemKey": "G281-ZJ-01",
              "status": "matched",
              "quote": {
                "itemKey": "G281-ZJ-01",
                "partNumber": "G281-ZJ-01",
                "partName": "金属支架",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  34
                ],
                "functions": [],
                "remarks": [
                  "恒伟林/贵龙/华凯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "恒伟林/贵龙/华凯"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              },
              "fixed": {
                "itemKey": "G281-ZJ-01",
                "partNumber": "G281-ZJ-01",
                "partName": "金属支架",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  84
                ],
                "functions": [],
                "remarks": [
                  "贵龙"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06102152"
                ],
                "suppliers": [
                  "贵龙"
                ],
                "sapNos": [
                  "A06102152"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              }
            },
            {
              "itemKey": "G281-ZJ-02",
              "status": "matched",
              "quote": {
                "itemKey": "G281-ZJ-02",
                "partNumber": "G281-ZJ-02",
                "partName": "金属支架",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  35
                ],
                "functions": [],
                "remarks": [
                  "恒伟林/贵龙/华凯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "恒伟林/贵龙/华凯"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              },
              "fixed": {
                "itemKey": "G281-ZJ-02",
                "partNumber": "G281-ZJ-02",
                "partName": "金属支架",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  85
                ],
                "functions": [],
                "remarks": [
                  "贵龙"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06102151"
                ],
                "suppliers": [
                  "贵龙"
                ],
                "sapNos": [
                  "A06102151"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              }
            },
            {
              "itemKey": "G281-ZJ-03",
              "status": "matched",
              "quote": {
                "itemKey": "G281-ZJ-03",
                "partNumber": "G281-ZJ-03",
                "partName": "金属支架",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  36
                ],
                "functions": [],
                "remarks": [
                  "恒伟林/贵龙/华凯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "恒伟林/贵龙/华凯"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              },
              "fixed": {
                "itemKey": "G281-ZJ-03",
                "partNumber": "G281-ZJ-03",
                "partName": "金属支架",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  86
                ],
                "functions": [],
                "remarks": [
                  "贵龙"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06102150"
                ],
                "suppliers": [
                  "贵龙"
                ],
                "sapNos": [
                  "A06102150"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              }
            },
            {
              "itemKey": "G281-ZJ-04",
              "status": "matched",
              "quote": {
                "itemKey": "G281-ZJ-04",
                "partNumber": "G281-ZJ-04",
                "partName": "金属支架",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  37
                ],
                "functions": [],
                "remarks": [
                  "恒伟林/贵龙/华凯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "恒伟林/贵龙/华凯"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              },
              "fixed": {
                "itemKey": "G281-ZJ-04",
                "partNumber": "G281-ZJ-04",
                "partName": "金属支架",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  87
                ],
                "functions": [],
                "remarks": [
                  "华凯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06102149"
                ],
                "suppliers": [
                  "华凯"
                ],
                "sapNos": [
                  "A06102149"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              }
            },
            {
              "itemKey": "G281-ZJ-05",
              "status": "matched",
              "quote": {
                "itemKey": "G281-ZJ-05",
                "partNumber": "G281-ZJ-05",
                "partName": "金属支架",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  38
                ],
                "functions": [],
                "remarks": [
                  "恒伟林/贵龙/华凯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "恒伟林/贵龙/华凯"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              },
              "fixed": {
                "itemKey": "G281-ZJ-05",
                "partNumber": "G281-ZJ-05",
                "partName": "金属支架",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  88
                ],
                "functions": [],
                "remarks": [
                  "华凯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06102147"
                ],
                "suppliers": [
                  "华凯"
                ],
                "sapNos": [
                  "A06102147"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              }
            },
            {
              "itemKey": "G281-HB-07",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "G281-HB-07",
                "partNumber": "G281-HB-07",
                "partName": "塑料护板",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  83
                ],
                "functions": [],
                "remarks": [
                  "上海程达"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06102153"
                ],
                "suppliers": [
                  "上海程达"
                ],
                "sapNos": [
                  "A06102153"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              }
            }
          ]
        },
        {
          "key": "sync_rubber",
          "label": "橡胶件类（同步开发件）",
          "section": "sync",
          "quoteCount": 5,
          "fixedCount": 6,
          "matchedCount": 5,
          "quoteOnlyCount": 0,
          "fixedOnlyCount": 1,
          "assemblyToPartsCount": 0,
          "assemblyPartCount": 0,
          "aligned": [
            {
              "itemKey": "G281-XJ-01",
              "status": "matched",
              "quote": {
                "itemKey": "G281-XJ-01",
                "partNumber": "G281-XJ-01",
                "partName": "橡胶件",
                "unit": "PCS",
                "quantity": 3,
                "rowNumbers": [
                  39
                ],
                "functions": [],
                "remarks": [
                  "恒伟林/远信/博昊/天乐"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "恒伟林/远信/博昊/天乐"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_rubber"
              },
              "fixed": {
                "itemKey": "G281-XJ-01",
                "partNumber": "G281-XJ-01",
                "partName": "橡胶件",
                "unit": "PCS",
                "quantity": 3,
                "rowNumbers": [
                  89
                ],
                "functions": [],
                "remarks": [
                  "博昊"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "博昊"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_rubber"
              }
            },
            {
              "itemKey": "G281-XJ-02",
              "status": "matched",
              "quote": {
                "itemKey": "G281-XJ-02",
                "partNumber": "G281-XJ-02",
                "partName": "橡胶件",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  40
                ],
                "functions": [],
                "remarks": [
                  "恒伟林/远信/博昊/天乐"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "恒伟林/远信/博昊/天乐"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_rubber"
              },
              "fixed": {
                "itemKey": "G281-XJ-02",
                "partNumber": "G281-XJ-02",
                "partName": "橡胶件",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  90
                ],
                "functions": [],
                "remarks": [
                  "博昊"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "博昊"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_rubber"
              }
            },
            {
              "itemKey": "G281-XJ-03",
              "status": "matched",
              "quote": {
                "itemKey": "G281-XJ-03",
                "partNumber": "G281-XJ-03",
                "partName": "橡胶件",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  41
                ],
                "functions": [],
                "remarks": [
                  "恒伟林/远信/博昊/天乐"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "恒伟林/远信/博昊/天乐"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_rubber"
              },
              "fixed": {
                "itemKey": "G281-XJ-03",
                "partNumber": "G281-XJ-03",
                "partName": "橡胶件",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  91
                ],
                "functions": [],
                "remarks": [
                  "博昊"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "博昊"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_rubber"
              }
            },
            {
              "itemKey": "G281-XJ-04",
              "status": "matched",
              "quote": {
                "itemKey": "G281-XJ-04",
                "partNumber": "G281-XJ-04",
                "partName": "橡胶件",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  42
                ],
                "functions": [],
                "remarks": [
                  "恒伟林/远信/博昊/天乐"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "恒伟林/远信/博昊/天乐"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_rubber"
              },
              "fixed": {
                "itemKey": "G281-XJ-04",
                "partNumber": "G281-XJ-04",
                "partName": "橡胶件",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  92
                ],
                "functions": [],
                "remarks": [
                  "博昊"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "博昊"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_rubber"
              }
            },
            {
              "itemKey": "G281-XJ-05",
              "status": "matched",
              "quote": {
                "itemKey": "G281-XJ-05",
                "partNumber": "G281-XJ-05",
                "partName": "橡胶件",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  43
                ],
                "functions": [],
                "remarks": [
                  "恒伟林/远信/博昊/天乐"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "恒伟林/远信/博昊/天乐"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_rubber"
              },
              "fixed": {
                "itemKey": "G281-XJ-05",
                "partNumber": "G281-XJ-05",
                "partName": "橡胶件",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  93
                ],
                "functions": [],
                "remarks": [
                  "博昊"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "博昊"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_rubber"
              }
            },
            {
              "itemKey": "G281-XJ-09",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "G281-XJ-09",
                "partNumber": "G281-XJ-09",
                "partName": "橡胶件",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  94
                ],
                "functions": [
                  "原G281-XJ-11"
                ],
                "remarks": [
                  "博昊"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "博昊"
                ],
                "sapNos": [],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_rubber"
              }
            }
          ]
        },
        {
          "key": "materials",
          "label": "其他物料",
          "section": "material",
          "quoteCount": 20,
          "fixedCount": 25,
          "matchedCount": 11,
          "quoteOnlyCount": 9,
          "fixedOnlyCount": 14,
          "assemblyToPartsCount": 0,
          "assemblyPartCount": 0,
          "aligned": [
            {
              "itemKey": "2377665-4",
              "status": "quote_only",
              "quote": {
                "itemKey": "2377665-4",
                "partNumber": "2377665-4",
                "partName": "防水栓",
                "unit": "PCS",
                "quantity": 18,
                "rowNumbers": [
                  10
                ],
                "functions": [],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A03033097"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "A03033097"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": null
            },
            {
              "itemKey": "963143-1",
              "status": "quote_only",
              "quote": {
                "itemKey": "963143-1",
                "partNumber": "963143-1",
                "partName": "盲栓（1/8/15/22）",
                "unit": "PCS",
                "quantity": 4,
                "rowNumbers": [
                  11
                ],
                "functions": [],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02031363"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "A02031363"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": null
            },
            {
              "itemKey": "BH4309802",
              "status": "matched",
              "quote": {
                "itemKey": "BH4309802",
                "partNumber": "BH4309802",
                "partName": "箭头扎带卡花",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  12
                ],
                "functions": [],
                "remarks": [
                  "博昊"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A06100441"
                ],
                "suppliers": [
                  "博昊"
                ],
                "sapNos": [
                  "A06100441"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "BH4309802",
                "partNumber": "BH4309802",
                "partName": "箭头扎带卡花",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  40
                ],
                "functions": [],
                "remarks": [
                  "博昊"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A06100441"
                ],
                "suppliers": [
                  "博昊"
                ],
                "sapNos": [
                  "A06100441"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "10800507250",
              "status": "quote_only",
              "quote": {
                "itemKey": "10800507250",
                "partNumber": "10800507250",
                "partName": "防水栓",
                "unit": "PCS",
                "quantity": 4,
                "rowNumbers": [
                  17
                ],
                "functions": [],
                "remarks": [
                  "赫尔斯曼"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A03011408"
                ],
                "suppliers": [
                  "赫尔斯曼"
                ],
                "sapNos": [
                  "A03011408"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": null
            },
            {
              "itemKey": "10106880",
              "status": "quote_only",
              "quote": {
                "itemKey": "10106880",
                "partNumber": "10106880",
                "partName": "接地热缩管",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  20
                ],
                "functions": [],
                "remarks": [
                  "深圳宏商/长春海达"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04032364"
                ],
                "suppliers": [
                  "深圳宏商/长春海达"
                ],
                "sapNos": [
                  "A04032364"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": null
            },
            {
              "itemKey": "LG3305D012B",
              "status": "quote_only",
              "quote": {
                "itemKey": "LG3305D012B",
                "partNumber": "LG3305D012B",
                "partName": "12OR橙色波纹管",
                "unit": "M",
                "quantity": 1.2,
                "rowNumbers": [
                  26
                ],
                "functions": [],
                "remarks": [
                  "骏鼎达/诗兰姆"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101161"
                ],
                "suppliers": [
                  "骏鼎达/诗兰姆"
                ],
                "sapNos": [
                  "A04101161"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": null
            },
            {
              "itemKey": "SCS2165A019",
              "status": "matched",
              "quote": {
                "itemKey": "SCS2165A019",
                "partNumber": "SCS2165A019",
                "partName": "19OR橙色编织套管",
                "unit": "M",
                "quantity": 2.79,
                "rowNumbers": [
                  27
                ],
                "functions": [],
                "remarks": [
                  "骏鼎达/明鑫"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101671"
                ],
                "suppliers": [
                  "骏鼎达/明鑫"
                ],
                "sapNos": [
                  "A04101671"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "SCS2165A019",
                "partNumber": "SCS2165A019",
                "partName": "19OR橙色编织套管",
                "unit": "M",
                "quantity": 2.79,
                "rowNumbers": [
                  78
                ],
                "functions": [],
                "remarks": [
                  "骏鼎达"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101671"
                ],
                "suppliers": [
                  "骏鼎达"
                ],
                "sapNos": [
                  "A04101671"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "LY5016019-OR2",
              "status": "matched",
              "quote": {
                "itemKey": "LY5016019-OR2",
                "partNumber": "LY5016019-OR2",
                "partName": "橙色布基胶带",
                "unit": "M",
                "quantity": 5,
                "rowNumbers": [
                  28
                ],
                "functions": [],
                "remarks": [
                  "联益"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101159"
                ],
                "suppliers": [
                  "联益"
                ],
                "sapNos": [
                  "A04101159"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "LY5016019-OR2",
                "partNumber": "LY5016019-OR2",
                "partName": "橙色布基胶带",
                "unit": "M",
                "quantity": 5,
                "rowNumbers": [
                  79
                ],
                "functions": [],
                "remarks": [
                  "联益"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101159"
                ],
                "suppliers": [
                  "联益"
                ],
                "sapNos": [
                  "A04101159"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "LY5016019",
              "status": "matched",
              "quote": {
                "itemKey": "LY5016019",
                "partNumber": "LY5016019",
                "partName": "黑色布基胶带",
                "unit": "M",
                "quantity": 1.66,
                "rowNumbers": [
                  29
                ],
                "functions": [],
                "remarks": [
                  "联益"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04030943"
                ],
                "suppliers": [
                  "联益"
                ],
                "sapNos": [
                  "A04030943"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "LY5016019",
                "partNumber": "LY5016019",
                "partName": "黑色布基胶带",
                "unit": "M",
                "quantity": 1.66,
                "rowNumbers": [
                  80
                ],
                "functions": [],
                "remarks": [
                  "联益"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04030943"
                ],
                "suppliers": [
                  "联益"
                ],
                "sapNos": [
                  "A04030943"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "P111W0192510002",
              "status": "quote_only",
              "quote": {
                "itemKey": "P111W0192510002",
                "partNumber": "P111W0192510002",
                "partName": "橙色PVC胶带",
                "unit": "M",
                "quantity": 4.5,
                "rowNumbers": [
                  30
                ],
                "functions": [],
                "remarks": [
                  "亚化"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101670"
                ],
                "suppliers": [
                  "亚化"
                ],
                "sapNos": [
                  "A04101670"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": null
            },
            {
              "itemKey": "6211015110AL",
              "status": "matched",
              "quote": {
                "itemKey": "6211015110AL",
                "partNumber": "6211015110AL",
                "partName": "防水泥",
                "unit": "PCS",
                "quantity": 3,
                "rowNumbers": [
                  31
                ],
                "functions": [],
                "remarks": [
                  "DSG/凯密科"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04010396"
                ],
                "suppliers": [
                  "DSG/凯密科"
                ],
                "sapNos": [
                  "A04010396"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "6211015110AL",
                "partNumber": "6211015110AL",
                "partName": "防水泥",
                "unit": "PCS",
                "quantity": 3,
                "rowNumbers": [
                  82
                ],
                "functions": [],
                "remarks": [
                  "DSG"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04010396"
                ],
                "suppliers": [
                  "DSG"
                ],
                "sapNos": [
                  "A04010396"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "PP9104320",
              "status": "matched",
              "quote": {
                "itemKey": "PP9104320",
                "partNumber": "PP9104320",
                "partName": "7*12箭头扎带",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  44
                ],
                "functions": [],
                "remarks": [
                  "上海众安/海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06101606"
                ],
                "suppliers": [
                  "上海众安/海尔曼太通"
                ],
                "sapNos": [
                  "A06101606"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "PP9104320",
                "partNumber": "PP9104320",
                "partName": "7*12箭头扎带",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  95
                ],
                "functions": [],
                "remarks": [
                  "上海众安"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06101606"
                ],
                "suppliers": [
                  "上海众安"
                ],
                "sapNos": [
                  "A06101606"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "PP9108401",
              "status": "quote_only",
              "quote": {
                "itemKey": "PP9108401",
                "partNumber": "PP9108401",
                "partName": "M8箭头卡扣",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  45
                ],
                "functions": [],
                "remarks": [
                  "上海众安/海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "上海众安/海尔曼太通"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": null
            },
            {
              "itemKey": "PP9122201",
              "status": "matched",
              "quote": {
                "itemKey": "PP9122201",
                "partNumber": "PP9122201",
                "partName": "M6竖置螺柱卡",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  46
                ],
                "functions": [],
                "remarks": [
                  "上海众安/海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06101666"
                ],
                "suppliers": [
                  "上海众安/海尔曼太通"
                ],
                "sapNos": [
                  "A06101666"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "PP9122201",
                "partNumber": "PP9122201",
                "partName": "M6立置螺柱卡",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  97
                ],
                "functions": [],
                "remarks": [
                  "上海众安"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06101666"
                ],
                "suppliers": [
                  "上海众安"
                ],
                "sapNos": [
                  "A06101666"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "PP9123801",
              "status": "quote_only",
              "quote": {
                "itemKey": "PP9123801",
                "partNumber": "PP9123801",
                "partName": "M5螺柱卡扣",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  47
                ],
                "functions": [],
                "remarks": [
                  "上海众安/海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "上海众安/海尔曼太通"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": null
            },
            {
              "itemKey": "PP9117701",
              "status": "matched",
              "quote": {
                "itemKey": "PP9117701",
                "partNumber": "PP9117701",
                "partName": "M6杉树卡扣",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  48
                ],
                "functions": [],
                "remarks": [
                  "上海众安/海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06004922"
                ],
                "suppliers": [
                  "上海众安/海尔曼太通"
                ],
                "sapNos": [
                  "A06004922"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "PP9117701",
                "partNumber": "PP9117701",
                "partName": "M6杉树卡扣",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  99
                ],
                "functions": [],
                "remarks": [
                  "上海众安"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06004922"
                ],
                "suppliers": [
                  "上海众安"
                ],
                "sapNos": [
                  "A06004922"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "PP9220301",
              "status": "matched",
              "quote": {
                "itemKey": "PP9220301",
                "partNumber": "PP9220301",
                "partName": "7*12箭头一字卡",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  49
                ],
                "functions": [],
                "remarks": [
                  "上海众安/海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06004079"
                ],
                "suppliers": [
                  "上海众安/海尔曼太通"
                ],
                "sapNos": [
                  "A06004079"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "PP9220301",
                "partNumber": "PP9220301",
                "partName": "7*12箭头一字卡",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  100
                ],
                "functions": [],
                "remarks": [
                  "上海众安"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06004079"
                ],
                "suppliers": [
                  "上海众安"
                ],
                "sapNos": [
                  "A06004079"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "111-00563",
              "status": "matched",
              "quote": {
                "itemKey": "111-00563",
                "partNumber": "111-00563",
                "partName": "扎带绳",
                "unit": "PCS",
                "quantity": 9,
                "rowNumbers": [
                  50
                ],
                "functions": [],
                "remarks": [
                  "上海众安/海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06010012"
                ],
                "suppliers": [
                  "上海众安/海尔曼太通"
                ],
                "sapNos": [
                  "A06010012"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "111-00563",
                "partNumber": "111-00563",
                "partName": "扎带绳",
                "unit": "PCS",
                "quantity": 7,
                "rowNumbers": [
                  101
                ],
                "functions": [],
                "remarks": [
                  "海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06010012"
                ],
                "suppliers": [
                  "海尔曼太通"
                ],
                "sapNos": [
                  "A06010012"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "108-00150",
              "status": "quote_only",
              "quote": {
                "itemKey": "108-00150",
                "partNumber": "108-00150",
                "partName": "扎带绳",
                "unit": "PCS",
                "quantity": 3,
                "rowNumbers": [
                  51
                ],
                "functions": [],
                "remarks": [
                  "上海众安/海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06100602"
                ],
                "suppliers": [
                  "上海众安/海尔曼太通"
                ],
                "sapNos": [
                  "A06100602"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": null
            },
            {
              "itemKey": "X1-BQ-01标签140X30MM",
              "status": "matched",
              "quote": {
                "itemKey": "X1-BQ-01标签140X30MM",
                "partNumber": "X1-BQ-01 标签140x30mm",
                "partName": "产品标签",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  52
                ],
                "functions": [],
                "remarks": [
                  "洪众"
                ],
                "otherRemarks": [],
                "wireNos": [
                  "70002326"
                ],
                "suppliers": [
                  "洪众"
                ],
                "sapNos": [
                  "70002326"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "X1-BQ-01标签140X30MM",
                "partNumber": "X1-BQ-01 标签140x30mm",
                "partName": "产品标签",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  104
                ],
                "functions": [],
                "remarks": [
                  "洪众"
                ],
                "otherRemarks": [],
                "wireNos": [
                  "70002326"
                ],
                "suppliers": [
                  "洪众"
                ],
                "sapNos": [
                  "70002326"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "2490531-6",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "2490531-6",
                "partNumber": "2490531-6",
                "partName": "法兰盘面板",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  6
                ],
                "functions": [],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A05100638"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "A05100638"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "2333692-1",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "2333692-1",
                "partNumber": "2333692-1",
                "partName": "M3.5螺栓",
                "unit": "PCS",
                "quantity": 6,
                "rowNumbers": [
                  21
                ],
                "functions": [],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A07003208"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "A07003208"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "2333693-1",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "2333693-1",
                "partNumber": "2333693-1",
                "partName": "M5螺栓",
                "unit": "PCS",
                "quantity": 4,
                "rowNumbers": [
                  22
                ],
                "functions": [],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A07003209"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "A07003209"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "5-2435306-1",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "5-2435306-1",
                "partNumber": "5-2435306-1",
                "partName": "盲堵",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  29
                ],
                "functions": [],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02101106"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "A02101106"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "HVSPC2P1900FF-09120",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "HVSPC2P1900FF-09120",
                "partNumber": "HVSPC2P1900FF-09120",
                "partName": "120mm²线夹",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  45
                ],
                "functions": [],
                "remarks": [
                  "安费诺"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02105130"
                ],
                "suppliers": [
                  "安费诺"
                ],
                "sapNos": [
                  "A02105130"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "HVSPC2P1900FF-07120",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "HVSPC2P1900FF-07120",
                "partNumber": "HVSPC2P1900FF-07120",
                "partName": "120mm²后盖",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  46
                ],
                "functions": [],
                "remarks": [
                  "安费诺"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02105125"
                ],
                "suppliers": [
                  "安费诺"
                ],
                "sapNos": [
                  "A02105125"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "HDGW12-30",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "HDGW12-30",
                "partNumber": "HDGW 12-30",
                "partName": "带胶-热缩管-黑色",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  54
                ],
                "functions": [
                  "AC-PE和DC-PE热缩管"
                ],
                "remarks": [
                  "长春海达"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04102221"
                ],
                "suppliers": [
                  "长春海达"
                ],
                "sapNos": [
                  "A04102221"
                ],
                "assemblyRefs": [
                  "AC-PE和DC-PE热缩管"
                ],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "HS-125(3X)9-30耐温125℃，内径8长度验证，申请样品验证后建号",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "HS-125(3X)9-30耐温125℃，内径8长度验证，申请样品验证后建号",
                "partNumber": "HS-125(3X) 9-30 耐温125℃，内径8长度验证，申请样品验证后建号",
                "partName": "不带胶-热缩管黑色",
                "unit": "PCS",
                "quantity": 4,
                "rowNumbers": [
                  55
                ],
                "functions": [
                  "L1/N/AC-PE/DC-PE使用热缩管"
                ],
                "remarks": [
                  "长春海达"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "长春海达"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [
                  "L1/N/AC-PE/DC-PE使用热缩管"
                ],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "LG3305R010B",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "LG3305R010B",
                "partNumber": "LG3305R010B",
                "partName": "10OR橙色波纹管",
                "unit": "M",
                "quantity": 1.2,
                "rowNumbers": [
                  77
                ],
                "functions": [],
                "remarks": [
                  "骏鼎达"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04102623"
                ],
                "suppliers": [
                  "骏鼎达"
                ],
                "sapNos": [
                  "A04102623"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "P111W0192510003",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "P111W0192510003",
                "partNumber": "P111W0192510003",
                "partName": "橙色PVC胶带",
                "unit": "M",
                "quantity": 4.5,
                "rowNumbers": [
                  81
                ],
                "functions": [],
                "remarks": [
                  "亚化"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101791"
                ],
                "suppliers": [
                  "亚化"
                ],
                "sapNos": [
                  "A04101791"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "126-00177",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "126-00177",
                "partNumber": "126-00177",
                "partName": "M6.5箭头卡扣",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  96
                ],
                "functions": [],
                "remarks": [
                  "海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06004365"
                ],
                "suppliers": [
                  "海尔曼太通"
                ],
                "sapNos": [
                  "A06004365"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "PP9120801",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "PP9120801",
                "partNumber": "PP9120801",
                "partName": "M6侧置螺柱卡",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  98
                ],
                "functions": [],
                "remarks": [
                  "上海众安"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06004924"
                ],
                "suppliers": [
                  "上海众安"
                ],
                "sapNos": [
                  "A06004924"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "111-00580",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "111-00580",
                "partNumber": "111-00580",
                "partName": "扎带绳",
                "unit": "PCS",
                "quantity": 4,
                "rowNumbers": [
                  102
                ],
                "functions": [],
                "remarks": [
                  "海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06000221"
                ],
                "suppliers": [
                  "海尔曼太通"
                ],
                "sapNos": [
                  "A06000221"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "PP9127401",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "PP9127401",
                "partNumber": "PP9127401",
                "partName": "隔线扎带绳",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  103
                ],
                "functions": [],
                "remarks": [
                  "上海众安"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06101064"
                ],
                "suppliers": [
                  "上海众安"
                ],
                "sapNos": [
                  "A06101064"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            }
          ]
        }
      ]
    },
    "6608516992": {
      "harnessId": "6608516992",
      "harnessName": "电动压缩机线束总成",
      "quoteSheet": "6608516992",
      "fixedSheet": "6608516992",
      "sources": {
        "quote": {
          "sheet": "6608516992",
          "itemCount": 24
        },
        "fixed": {
          "sheet": "6608516992",
          "itemCount": 44
        }
      },
      "summary": {
        "groupCount": 7,
        "connectorGroupCount": 4,
        "syncGroupCount": 1,
        "quoteItemCount": 24,
        "fixedItemCount": 42,
        "matchedCount": 11,
        "quoteOnlyCount": 11,
        "fixedOnlyCount": 17,
        "assemblyToPartsCount": 2,
        "assemblyPartCount": 14,
        "wireMatchedCount": 0,
        "syncMatchedCount": 0,
        "materialMatchedCount": 5
      },
      "groups": [
        {
          "key": "battery_end",
          "label": "接电池端",
          "section": "connector",
          "quoteCount": 1,
          "fixedCount": 7,
          "matchedCount": 0,
          "quoteOnlyCount": 0,
          "fixedOnlyCount": 0,
          "assemblyToPartsCount": 1,
          "assemblyPartCount": 7,
          "aligned": [
            {
              "itemKey": "YGC1612-EV-PW2PNA2-4",
              "status": "assembly_to_parts",
              "mappingType": "assembly_to_parts",
              "quote": {
                "itemKey": "YGC1612-EV-PW2PNA2-4",
                "partNumber": "YGC1612-EV-PW2PNA2-4",
                "partName": "连接器总成",
                "unit": "SET",
                "quantity": 1,
                "rowNumbers": [
                  6
                ],
                "functions": [
                  "接电池端"
                ],
                "remarks": [
                  "永贵"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "永贵"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [
                  "YGC1612-EV-PW2PNA2-4"
                ],
                "kind": "connector",
                "groupKey": "battery_end"
              },
              "fixed": null,
              "fixedParts": [
                {
                  "itemKey": "113990002546",
                  "partNumber": "113990002546",
                  "partName": "YGC1612-EV-P2PWNA1插头组件",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    12
                  ],
                  "functions": [
                    "135度角度出线"
                  ],
                  "remarks": [
                    "永贵"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105150"
                  ],
                  "suppliers": [
                    "永贵"
                  ],
                  "sapNos": [
                    "A02105150"
                  ],
                  "assemblyRefs": [
                    "YGC1612-EV-P2PWNA1-4 135度角度出线 （永贵带50A保险，取消互锁，工具解锁） 接电池端 适配4mm²屏蔽铜包铝交联铝导线"
                  ],
                  "kind": "connector",
                  "groupKey": "battery_end"
                },
                {
                  "itemKey": "113020602561",
                  "partNumber": "113020602561",
                  "partName": "5.8×0.8WABOO3-(T40-T60)SW孔端子组件-链式",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    13
                  ],
                  "functions": [],
                  "remarks": [
                    "永贵"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03103441"
                  ],
                  "suppliers": [
                    "永贵"
                  ],
                  "sapNos": [
                    "A03103441"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "battery_end"
                },
                {
                  "itemKey": "113029800652",
                  "partNumber": "113029800652",
                  "partName": "5.8×0.8WAS002-(T40-T60)SW针端子组件-链式",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    14
                  ],
                  "functions": [],
                  "remarks": [
                    "永贵"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03103442"
                  ],
                  "suppliers": [
                    "永贵"
                  ],
                  "sapNos": [
                    "A03103442"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "battery_end"
                },
                {
                  "itemKey": "114022500495",
                  "partNumber": "114022500495",
                  "partName": "YG1467屏蔽件-外-4",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    15
                  ],
                  "functions": [],
                  "remarks": [
                    "永贵"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03103443"
                  ],
                  "suppliers": [
                    "永贵"
                  ],
                  "sapNos": [
                    "A03103443"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "battery_end"
                },
                {
                  "itemKey": "114022500492",
                  "partNumber": "114022500492",
                  "partName": "YG1467屏蔽件-内-4",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    16
                  ],
                  "functions": [],
                  "remarks": [
                    "永贵"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03103444"
                  ],
                  "suppliers": [
                    "永贵"
                  ],
                  "sapNos": [
                    "A03103444"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "battery_end"
                },
                {
                  "itemKey": "114069806819",
                  "partNumber": "114069806819",
                  "partName": "Ф6.7尾盖(黑)",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    19
                  ],
                  "functions": [],
                  "remarks": [
                    "永贵"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105148"
                  ],
                  "suppliers": [
                    "永贵"
                  ],
                  "sapNos": [
                    "A02105148"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "battery_end"
                },
                {
                  "itemKey": "114069807132",
                  "partNumber": "114069807132",
                  "partName": "Ф6尾盖1(黑)",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    20
                  ],
                  "functions": [],
                  "remarks": [
                    "永贵"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105147"
                  ],
                  "suppliers": [
                    "永贵"
                  ],
                  "sapNos": [
                    "A02105147"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "battery_end"
                }
              ]
            }
          ]
        },
        {
          "key": "accm_end",
          "label": "接ACCM端",
          "section": "connector",
          "quoteCount": 1,
          "fixedCount": 7,
          "matchedCount": 0,
          "quoteOnlyCount": 0,
          "fixedOnlyCount": 0,
          "assemblyToPartsCount": 1,
          "assemblyPartCount": 7,
          "aligned": [
            {
              "itemKey": "2521188-1",
              "status": "assembly_to_parts",
              "mappingType": "assembly_to_parts",
              "quote": {
                "itemKey": "2521188-1",
                "partNumber": "2521188-1",
                "partName": "连接器总成",
                "unit": "SET",
                "quantity": 1,
                "rowNumbers": [
                  5
                ],
                "functions": [
                  "接ACCM端"
                ],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [
                  "2521188-1"
                ],
                "kind": "connector",
                "groupKey": "accm_end"
              },
              "fixed": null,
              "fixedParts": [
                {
                  "itemKey": "2509744-1",
                  "partNumber": "2509744-1",
                  "partName": "护套",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    5
                  ],
                  "functions": [
                    "（泰科，取消互锁，工具解锁）"
                  ],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105029"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A02105029"
                  ],
                  "assemblyRefs": [
                    "2521188-1 （泰科，取消互锁，工具解锁） 接ACCM端 适配4mm²屏蔽铜包铝交联铝导线"
                  ],
                  "kind": "connector",
                  "groupKey": "accm_end"
                },
                {
                  "itemKey": "2508246-1",
                  "partNumber": "2508246-1",
                  "partName": "链式-焊接端子",
                  "unit": "PCS",
                  "quantity": 4,
                  "rowNumbers": [
                    6,
                    22
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03102426"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A03102426"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "accm_end"
                },
                {
                  "itemKey": "2474445-5",
                  "partNumber": "2474445-5",
                  "partName": "外屏蔽环",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    7
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03103031"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A03103031"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "accm_end"
                },
                {
                  "itemKey": "1-2350495-3",
                  "partNumber": "1-2350495-3",
                  "partName": "内屏蔽环",
                  "unit": "PCS",
                  "quantity": 4,
                  "rowNumbers": [
                    8,
                    24
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03032325"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A03032325"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "accm_end"
                },
                {
                  "itemKey": "2519472-1",
                  "partNumber": "2519472-1",
                  "partName": "挡板",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    9
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105028"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A02105028"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "accm_end"
                },
                {
                  "itemKey": "2474450-5",
                  "partNumber": "2474450-5",
                  "partName": "密封圈",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    10
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02104232"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A02104232"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "accm_end"
                },
                {
                  "itemKey": "2474448-5",
                  "partNumber": "2474448-5",
                  "partName": "尾盖",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    11
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02104233"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A02104233"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "accm_end"
                }
              ]
            }
          ]
        },
        {
          "key": "ptc_end",
          "label": "接PTC端",
          "section": "connector",
          "quoteCount": 1,
          "fixedCount": 4,
          "matchedCount": 1,
          "quoteOnlyCount": 0,
          "fixedOnlyCount": 3,
          "assemblyToPartsCount": 0,
          "assemblyPartCount": 0,
          "aligned": [
            {
              "itemKey": "1-2509498-1",
              "status": "matched",
              "quote": {
                "itemKey": "1-2509498-1",
                "partNumber": "1-2509498-1",
                "partName": "连接器总成",
                "unit": "SET",
                "quantity": 1,
                "rowNumbers": [
                  7
                ],
                "functions": [
                  "接PTC"
                ],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [
                  "1-2509498-1"
                ],
                "kind": "connector",
                "groupKey": "ptc_end"
              },
              "fixed": {
                "itemKey": "1-2509498-1",
                "partNumber": "1-2509498-1",
                "partName": "护套",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  21
                ],
                "functions": [
                  "（TE，取消互锁，工具解锁）"
                ],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02104830"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "A02104830"
                ],
                "assemblyRefs": [
                  "1-2509498-1 （TE，取消互锁，工具解锁） 接PTC 适配4mm²屏蔽铜包铝交联铝导线"
                ],
                "kind": "connector",
                "groupKey": "ptc_end"
              }
            },
            {
              "itemKey": "2350478-3",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "2350478-3",
                "partNumber": "2350478-3",
                "partName": "外屏蔽环",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  23
                ],
                "functions": [],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A03031396"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "A03031396"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "ptc_end"
              }
            },
            {
              "itemKey": "2404135-2",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "2404135-2",
                "partNumber": "2404135-2",
                "partName": "密封圈",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  26
                ],
                "functions": [],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02103713"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "A02103713"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "ptc_end"
              }
            },
            {
              "itemKey": "1-2310469-5",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "1-2310469-5",
                "partNumber": "1-2310469-5",
                "partName": "尾盖",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  27
                ],
                "functions": [],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02033357"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "A02033357"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "ptc_end"
              }
            }
          ]
        },
        {
          "key": "branch_splitter",
          "label": "分线器",
          "section": "connector",
          "quoteCount": 12,
          "fixedCount": 11,
          "matchedCount": 5,
          "quoteOnlyCount": 7,
          "fixedOnlyCount": 6,
          "assemblyToPartsCount": 0,
          "assemblyPartCount": 0,
          "aligned": [
            {
              "itemKey": "F02-372010-B04",
              "status": "matched",
              "quote": {
                "itemKey": "F02-372010-B04",
                "partNumber": "F02-372010-B04",
                "partName": "左尾盖",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  8
                ],
                "functions": [
                  "二分四分线器"
                ],
                "remarks": [
                  "八达"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "八达"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [
                  "F02-372011-110"
                ],
                "kind": "connector",
                "groupKey": "branch_splitter"
              },
              "fixed": {
                "itemKey": "F02-372010-B04",
                "partNumber": "F02-372010-B04",
                "partName": "左尾盖",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  28
                ],
                "functions": [
                  "二分四分线器"
                ],
                "remarks": [
                  "八达"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02104778"
                ],
                "suppliers": [
                  "八达"
                ],
                "sapNos": [
                  "A02104778"
                ],
                "assemblyRefs": [
                  "F02-372011-111 二分四分线器 适配6*4mm²屏蔽铜包铝交联铝导线"
                ],
                "kind": "connector",
                "groupKey": "branch_splitter"
              }
            },
            {
              "itemKey": "F02-372010-G01",
              "status": "matched",
              "quote": {
                "itemKey": "F02-372010-G01",
                "partNumber": "F02-372010-G01",
                "partName": "密封圈",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  9
                ],
                "functions": [],
                "remarks": [
                  "八达"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "八达"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "branch_splitter"
              },
              "fixed": {
                "itemKey": "F02-372010-G01",
                "partNumber": "F02-372010-G01",
                "partName": "密封圈",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  29
                ],
                "functions": [],
                "remarks": [
                  "八达"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02104777"
                ],
                "suppliers": [
                  "八达"
                ],
                "sapNos": [
                  "A02104777"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "branch_splitter"
              }
            },
            {
              "itemKey": "F02-372010-03H",
              "status": "matched",
              "quote": {
                "itemKey": "F02-372010-03H",
                "partNumber": "F02-372010-03H",
                "partName": "屏蔽环",
                "unit": "PCS",
                "quantity": 4,
                "rowNumbers": [
                  10
                ],
                "functions": [],
                "remarks": [
                  "八达"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "八达"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "branch_splitter"
              },
              "fixed": {
                "itemKey": "F02-372010-03H",
                "partNumber": "F02-372010-03H",
                "partName": "屏蔽环",
                "unit": "PCS",
                "quantity": 4,
                "rowNumbers": [
                  30
                ],
                "functions": [],
                "remarks": [
                  "八达"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A03103293"
                ],
                "suppliers": [
                  "八达"
                ],
                "sapNos": [
                  "A03103293"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "branch_splitter"
              }
            },
            {
              "itemKey": "F02-372010-B02",
              "status": "quote_only",
              "quote": {
                "itemKey": "F02-372010-B02",
                "partNumber": "F02-372010-B02",
                "partName": "上内壳体",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  11
                ],
                "functions": [],
                "remarks": [
                  "八达"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "八达"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "branch_splitter"
              },
              "fixed": null
            },
            {
              "itemKey": "F02-372010-07H",
              "status": "quote_only",
              "quote": {
                "itemKey": "F02-372010-07H",
                "partNumber": "F02-372010-07H",
                "partName": "上屏蔽罩",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  12
                ],
                "functions": [],
                "remarks": [
                  "八达"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "八达"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "branch_splitter"
              },
              "fixed": null
            },
            {
              "itemKey": "F02-372010-B03",
              "status": "quote_only",
              "quote": {
                "itemKey": "F02-372010-B03",
                "partNumber": "F02-372010-B03",
                "partName": "下内壳体",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  13
                ],
                "functions": [],
                "remarks": [
                  "八达"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "八达"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "branch_splitter"
              },
              "fixed": null
            },
            {
              "itemKey": "F02-372010-08H",
              "status": "quote_only",
              "quote": {
                "itemKey": "F02-372010-08H",
                "partNumber": "F02-372010-08H",
                "partName": "下屏蔽罩",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  14
                ],
                "functions": [],
                "remarks": [
                  "八达"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "八达"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "branch_splitter"
              },
              "fixed": null
            },
            {
              "itemKey": "F02-372010-04H",
              "status": "matched",
              "quote": {
                "itemKey": "F02-372010-04H",
                "partNumber": "F02-372010-04H",
                "partName": "屏蔽环",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  15
                ],
                "functions": [],
                "remarks": [
                  "八达"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "八达"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "branch_splitter"
              },
              "fixed": {
                "itemKey": "F02-372010-04H",
                "partNumber": "F02-372010-04H",
                "partName": "屏蔽环",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  35
                ],
                "functions": [],
                "remarks": [
                  "八达"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A03103292"
                ],
                "suppliers": [
                  "八达"
                ],
                "sapNos": [
                  "A03103292"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "branch_splitter"
              }
            },
            {
              "itemKey": "F02-372010-09B",
              "status": "quote_only",
              "quote": {
                "itemKey": "F02-372010-09B",
                "partNumber": "F02-372010-09B",
                "partName": "屏蔽内环",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  16
                ],
                "functions": [],
                "remarks": [
                  "八达"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "八达"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "branch_splitter"
              },
              "fixed": null
            },
            {
              "itemKey": "F11-001-000082",
              "status": "matched",
              "quote": {
                "itemKey": "F11-001-000082",
                "partNumber": "F11-001-000082",
                "partName": "护套",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  17
                ],
                "functions": [],
                "remarks": [
                  "八达"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "八达"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "branch_splitter"
              },
              "fixed": {
                "itemKey": "F11-001-000082",
                "partNumber": "F11-001-000082",
                "partName": "护套",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  36
                ],
                "functions": [],
                "remarks": [
                  "八达"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A05100590"
                ],
                "suppliers": [
                  "八达"
                ],
                "sapNos": [
                  "A05100590"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "branch_splitter"
              }
            },
            {
              "itemKey": "F02-372010-G06",
              "status": "quote_only",
              "quote": {
                "itemKey": "F02-372010-G06",
                "partNumber": "F02-372010-G06",
                "partName": "密封圈",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  18
                ],
                "functions": [],
                "remarks": [
                  "八达"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "八达"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "branch_splitter"
              },
              "fixed": null
            },
            {
              "itemKey": "F02-372010-B12",
              "status": "quote_only",
              "quote": {
                "itemKey": "F02-372010-B12",
                "partNumber": "F02-372010-B12",
                "partName": "尾盖",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  19
                ],
                "functions": [],
                "remarks": [
                  "八达"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "八达"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "branch_splitter"
              },
              "fixed": null
            },
            {
              "itemKey": "F02-372010-B06",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "F02-372010-B06",
                "partNumber": "F02-372010-B06",
                "partName": "上内壳体",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  31
                ],
                "functions": [],
                "remarks": [
                  "八达"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02105137"
                ],
                "suppliers": [
                  "八达"
                ],
                "sapNos": [
                  "A02105137"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "branch_splitter"
              }
            },
            {
              "itemKey": "F02-372010-05H",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "F02-372010-05H",
                "partNumber": "F02-372010-05H",
                "partName": "上屏蔽罩",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  32
                ],
                "functions": [],
                "remarks": [
                  "八达"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02105136"
                ],
                "suppliers": [
                  "八达"
                ],
                "sapNos": [
                  "A02105136"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "branch_splitter"
              }
            },
            {
              "itemKey": "F02-372010-B07",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "F02-372010-B07",
                "partNumber": "F02-372010-B07",
                "partName": "下内壳体",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  33
                ],
                "functions": [],
                "remarks": [
                  "八达"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02105139"
                ],
                "suppliers": [
                  "八达"
                ],
                "sapNos": [
                  "A02105139"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "branch_splitter"
              }
            },
            {
              "itemKey": "F02-372010-06H",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "F02-372010-06H",
                "partNumber": "F02-372010-06H",
                "partName": "下屏蔽罩",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  34
                ],
                "functions": [],
                "remarks": [
                  "八达"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02105138"
                ],
                "suppliers": [
                  "八达"
                ],
                "sapNos": [
                  "A02105138"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "branch_splitter"
              }
            },
            {
              "itemKey": "F02-372010-G04",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "F02-372010-G04",
                "partNumber": "F02-372010-G04",
                "partName": "密封圈",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  37
                ],
                "functions": [],
                "remarks": [
                  "八达"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02105134"
                ],
                "suppliers": [
                  "八达"
                ],
                "sapNos": [
                  "A02105134"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "branch_splitter"
              }
            },
            {
              "itemKey": "F02-372010-B08",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "F02-372010-B08",
                "partNumber": "F02-372010-B08",
                "partName": "尾盖",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  38
                ],
                "functions": [],
                "remarks": [
                  "八达"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02105135"
                ],
                "suppliers": [
                  "八达"
                ],
                "sapNos": [
                  "A02105135"
                ],
                "assemblyRefs": [],
                "kind": "connector",
                "groupKey": "branch_splitter"
              }
            }
          ]
        },
        {
          "key": "wires",
          "label": "导线",
          "section": "wire",
          "quoteCount": 1,
          "fixedCount": 1,
          "matchedCount": 0,
          "quoteOnlyCount": 1,
          "fixedOnlyCount": 1,
          "assemblyToPartsCount": 0,
          "assemblyPartCount": 0,
          "aligned": [
            {
              "itemKey": "FHLALR91XCCAATB91X/4.0/橙",
              "status": "quote_only",
              "quote": {
                "itemKey": "FHLALR91XCCAATB91X/4.0/橙",
                "partNumber": "FHLALR91XCCAATB91X/4.0/橙",
                "partName": "4.0mm²屏蔽镀锡铜包铝交联铝导线",
                "unit": "M",
                "quantity": 2.31,
                "rowNumbers": [
                  21
                ],
                "functions": [],
                "remarks": [
                  "太平洋/鑫宏业"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "太平洋/鑫宏业"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              },
              "fixed": null
            },
            {
              "itemKey": "FHLALR91XCCAATB91X/4.0/橙/AL8",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "FHLALR91XCCAATB91X/4.0/橙/AL8",
                "partNumber": "FHLALR91XCCAATB91X/4.0/橙/AL8",
                "partName": "4.0mm²屏蔽镀锡铜包铝交联铝导线",
                "unit": "M",
                "quantity": 2.53,
                "rowNumbers": [
                  39
                ],
                "functions": [],
                "remarks": [
                  "鑫宏业"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01103226"
                ],
                "suppliers": [
                  "鑫宏业"
                ],
                "sapNos": [
                  "A01103226"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            }
          ]
        },
        {
          "key": "sync_rubber",
          "label": "橡胶件类（同步开发件）",
          "section": "sync",
          "quoteCount": 0,
          "fixedCount": 1,
          "matchedCount": 0,
          "quoteOnlyCount": 0,
          "fixedOnlyCount": 1,
          "assemblyToPartsCount": 0,
          "assemblyPartCount": 0,
          "aligned": [
            {
              "itemKey": "G281-XJ-09",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "G281-XJ-09",
                "partNumber": "G281-XJ-09",
                "partName": "橡胶件",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  46
                ],
                "functions": [
                  "原G281-XJ-10"
                ],
                "remarks": [
                  "博昊"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "博昊"
                ],
                "sapNos": [],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_rubber"
              }
            }
          ]
        },
        {
          "key": "materials",
          "label": "其他物料",
          "section": "material",
          "quoteCount": 8,
          "fixedCount": 11,
          "matchedCount": 5,
          "quoteOnlyCount": 3,
          "fixedOnlyCount": 6,
          "assemblyToPartsCount": 0,
          "assemblyPartCount": 0,
          "aligned": [
            {
              "itemKey": "HS-1257.0-20",
              "status": "quote_only",
              "quote": {
                "itemKey": "HS-1257.0-20",
                "partNumber": "HS-125 7.0-20",
                "partName": "不带胶-热缩管",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  20
                ],
                "functions": [],
                "remarks": [
                  "深圳宏商/长春海达"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101984"
                ],
                "suppliers": [
                  "深圳宏商/长春海达"
                ],
                "sapNos": [
                  "A04101984"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": null
            },
            {
              "itemKey": "LG3305D012B",
              "status": "matched",
              "quote": {
                "itemKey": "LG3305D012B",
                "partNumber": "LG3305D012B",
                "partName": "12OR橙色波纹管",
                "unit": "M",
                "quantity": 0.52,
                "rowNumbers": [
                  22
                ],
                "functions": [],
                "remarks": [
                  "骏鼎达/诗兰姆"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101161"
                ],
                "suppliers": [
                  "骏鼎达/诗兰姆"
                ],
                "sapNos": [
                  "A04101161"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "LG3305D012B",
                "partNumber": "LG3305D012B",
                "partName": "12OR橙色波纹管",
                "unit": "M",
                "quantity": 0.52,
                "rowNumbers": [
                  40
                ],
                "functions": [],
                "remarks": [
                  "骏鼎达"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101161"
                ],
                "suppliers": [
                  "骏鼎达"
                ],
                "sapNos": [
                  "A04101161"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "LY5016019-OR2",
              "status": "matched",
              "quote": {
                "itemKey": "LY5016019-OR2",
                "partNumber": "LY5016019-OR2",
                "partName": "橙色布基胶带",
                "unit": "M",
                "quantity": 1,
                "rowNumbers": [
                  23
                ],
                "functions": [],
                "remarks": [
                  "联益"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101159"
                ],
                "suppliers": [
                  "联益"
                ],
                "sapNos": [
                  "A04101159"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "LY5016019-OR2",
                "partNumber": "LY5016019-OR2",
                "partName": "橙色布基胶带",
                "unit": "M",
                "quantity": 1.2,
                "rowNumbers": [
                  41
                ],
                "functions": [],
                "remarks": [
                  "联益"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101159"
                ],
                "suppliers": [
                  "联益"
                ],
                "sapNos": [
                  "A04101159"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "P111W0192510002",
              "status": "quote_only",
              "quote": {
                "itemKey": "P111W0192510002",
                "partNumber": "P111W0192510002",
                "partName": "橙色PVC胶带",
                "unit": "M",
                "quantity": 4,
                "rowNumbers": [
                  24
                ],
                "functions": [],
                "remarks": [
                  "亚化"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101670"
                ],
                "suppliers": [
                  "亚化"
                ],
                "sapNos": [
                  "A04101670"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": null
            },
            {
              "itemKey": "PP9108801",
              "status": "matched",
              "quote": {
                "itemKey": "PP9108801",
                "partNumber": "PP9108801",
                "partName": "7*12加高箭头扎带",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  25
                ],
                "functions": [],
                "remarks": [
                  "上海众安/海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06010236"
                ],
                "suppliers": [
                  "上海众安/海尔曼太通"
                ],
                "sapNos": [
                  "A06010236"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "PP9108801",
                "partNumber": "PP9108801",
                "partName": "7*12加高箭头扎带",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  43
                ],
                "functions": [],
                "remarks": [
                  "上海众安"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06010236"
                ],
                "suppliers": [
                  "上海众安"
                ],
                "sapNos": [
                  "A06010236"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "PP9114201",
              "status": "quote_only",
              "quote": {
                "itemKey": "PP9114201",
                "partNumber": "PP9114201",
                "partName": "M6抬高螺柱卡",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  26
                ],
                "functions": [],
                "remarks": [
                  "上海众安/海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06003890"
                ],
                "suppliers": [
                  "上海众安/海尔曼太通"
                ],
                "sapNos": [
                  "A06003890"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": null
            },
            {
              "itemKey": "PP9109401",
              "status": "matched",
              "quote": {
                "itemKey": "PP9109401",
                "partNumber": "PP9109401",
                "partName": "M6杉树卡扣",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  27
                ],
                "functions": [],
                "remarks": [
                  "上海众安/海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06003888"
                ],
                "suppliers": [
                  "上海众安/海尔曼太通"
                ],
                "sapNos": [
                  "A06003888"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "PP9109401",
                "partNumber": "PP9109401",
                "partName": "M6杉树卡扣",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  45
                ],
                "functions": [],
                "remarks": [
                  "上海众安"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06003888"
                ],
                "suppliers": [
                  "上海众安"
                ],
                "sapNos": [
                  "A06003888"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "X1-BQ-01标签140X30MM",
              "status": "matched",
              "quote": {
                "itemKey": "X1-BQ-01标签140X30MM",
                "partNumber": "X1-BQ-01 标签140x30mm",
                "partName": "产品标签",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  28
                ],
                "functions": [],
                "remarks": [
                  "洪众"
                ],
                "otherRemarks": [],
                "wireNos": [
                  "70002326"
                ],
                "suppliers": [
                  "洪众"
                ],
                "sapNos": [
                  "70002326"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "X1-BQ-01标签140X30MM",
                "partNumber": "X1-BQ-01 标签140x30mm",
                "partName": "产品标签",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  48
                ],
                "functions": [],
                "remarks": [
                  "洪众"
                ],
                "otherRemarks": [],
                "wireNos": [
                  "70002326"
                ],
                "suppliers": [
                  "洪众"
                ],
                "sapNos": [
                  "70002326"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "114050501799",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "114050501799",
                "partNumber": "114050501799",
                "partName": "YGEV2-1封线体-13.9",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  17
                ],
                "functions": [],
                "remarks": [
                  "永贵"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02101178"
                ],
                "suppliers": [
                  "永贵"
                ],
                "sapNos": [
                  "A02101178"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "114050502508",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "114050502508",
                "partNumber": "114050502508",
                "partName": "YG1612-1封线体-Ф3.9",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  18
                ],
                "functions": [],
                "remarks": [
                  "永贵"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02105146"
                ],
                "suppliers": [
                  "永贵"
                ],
                "sapNos": [
                  "A02105146"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "2481575-2",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "2481575-2",
                "partNumber": "2481575-2",
                "partName": "开口-垫片",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  25
                ],
                "functions": [],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02101462"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "A02101462"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "P111W0192510003",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "P111W0192510003",
                "partNumber": "P111W0192510003",
                "partName": "橙色PVC胶带",
                "unit": "M",
                "quantity": 4,
                "rowNumbers": [
                  42
                ],
                "functions": [],
                "remarks": [
                  "亚化"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101791"
                ],
                "suppliers": [
                  "亚化"
                ],
                "sapNos": [
                  "A04101791"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "156-03490",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "156-03490",
                "partNumber": "156-03490",
                "partName": "T5抬高螺柱卡",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  44
                ],
                "functions": [],
                "remarks": [
                  "海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06101040"
                ],
                "suppliers": [
                  "海尔曼太通"
                ],
                "sapNos": [
                  "A06101040"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "111-00563",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "111-00563",
                "partNumber": "111-00563",
                "partName": "扎带绳",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  47
                ],
                "functions": [],
                "remarks": [
                  "海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06010012"
                ],
                "suppliers": [
                  "海尔曼太通"
                ],
                "sapNos": [
                  "A06010012"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            }
          ]
        }
      ]
    },
    "6608519100": {
      "harnessId": "6608519100",
      "harnessName": "电动压缩机线束总成",
      "quoteSheet": "6608519100",
      "fixedSheet": "6608519100",
      "sources": {
        "quote": {
          "sheet": "6608519100",
          "itemCount": 11
        },
        "fixed": {
          "sheet": "6608519100",
          "itemCount": 23
        }
      },
      "summary": {
        "groupCount": 5,
        "connectorGroupCount": 2,
        "syncGroupCount": 1,
        "quoteItemCount": 11,
        "fixedItemCount": 23,
        "matchedCount": 6,
        "quoteOnlyCount": 3,
        "fixedOnlyCount": 4,
        "assemblyToPartsCount": 2,
        "assemblyPartCount": 13,
        "wireMatchedCount": 0,
        "syncMatchedCount": 1,
        "materialMatchedCount": 6
      },
      "groups": [
        {
          "key": "edrive_end",
          "label": "接电驱端",
          "section": "connector",
          "quoteCount": 1,
          "fixedCount": 6,
          "matchedCount": 0,
          "quoteOnlyCount": 0,
          "fixedOnlyCount": 0,
          "assemblyToPartsCount": 1,
          "assemblyPartCount": 6,
          "aligned": [
            {
              "itemKey": "PEVC-040-P42A-004-W",
              "status": "assembly_to_parts",
              "mappingType": "assembly_to_parts",
              "quote": {
                "itemKey": "PEVC-040-P42A-004-W",
                "partNumber": "PEVC-040-P42A-004-W",
                "partName": "连接器总成",
                "unit": "SET",
                "quantity": 1,
                "rowNumbers": [
                  6
                ],
                "functions": [
                  "接电驱"
                ],
                "remarks": [
                  "菲尼克斯"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "菲尼克斯"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [
                  "PEVC-040-P42A-004-W"
                ],
                "kind": "connector",
                "groupKey": "edrive_end"
              },
              "fixed": null,
              "fixedParts": [
                {
                  "itemKey": "1890945",
                  "partNumber": "1890945",
                  "partName": "护套-插头半成品",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    12
                  ],
                  "functions": [
                    "（菲尼克斯带，取消互锁，工具解锁）"
                  ],
                  "remarks": [
                    "菲尼克斯"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105026"
                  ],
                  "suppliers": [
                    "菲尼克斯"
                  ],
                  "sapNos": [
                    "A02105026"
                  ],
                  "assemblyRefs": [
                    "PEVC-040-P42A-004-W （菲尼克斯带，取消互锁，工具解锁） 接电驱 适配4mm²屏蔽铜包铝交联铝导线"
                  ],
                  "kind": "connector",
                  "groupKey": "edrive_end"
                },
                {
                  "itemKey": "1890948",
                  "partNumber": "1890948",
                  "partName": "焊接端子",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    13
                  ],
                  "functions": [],
                  "remarks": [
                    "菲尼克斯"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03103392"
                  ],
                  "suppliers": [
                    "菲尼克斯"
                  ],
                  "sapNos": [
                    "A03103392"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "edrive_end"
                },
                {
                  "itemKey": "1806556",
                  "partNumber": "1806556",
                  "partName": "屏蔽外环",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    14
                  ],
                  "functions": [],
                  "remarks": [
                    "菲尼克斯"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03103390"
                  ],
                  "suppliers": [
                    "菲尼克斯"
                  ],
                  "sapNos": [
                    "A03103390"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "edrive_end"
                },
                {
                  "itemKey": "1806554",
                  "partNumber": "1806554",
                  "partName": "4方屏蔽内环",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    15
                  ],
                  "functions": [],
                  "remarks": [
                    "菲尼克斯"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03103391"
                  ],
                  "suppliers": [
                    "菲尼克斯"
                  ],
                  "sapNos": [
                    "A03103391"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "edrive_end"
                },
                {
                  "itemKey": "1806550",
                  "partNumber": "1806550",
                  "partName": "4方线束密封圈(红色)",
                  "unit": "PCS",
                  "quantity": 4,
                  "rowNumbers": [
                    16
                  ],
                  "functions": [],
                  "remarks": [
                    "菲尼克斯"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105023"
                  ],
                  "suppliers": [
                    "菲尼克斯"
                  ],
                  "sapNos": [
                    "A02105023"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "edrive_end"
                },
                {
                  "itemKey": "1806425",
                  "partNumber": "1806425",
                  "partName": "4方线束尾盖(红色)",
                  "unit": "PCS",
                  "quantity": 4,
                  "rowNumbers": [
                    17
                  ],
                  "functions": [],
                  "remarks": [
                    "菲尼克斯"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105024"
                  ],
                  "suppliers": [
                    "菲尼克斯"
                  ],
                  "sapNos": [
                    "A02105024"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "edrive_end"
                }
              ]
            }
          ]
        },
        {
          "key": "accm_end",
          "label": "接ACCM端",
          "section": "connector",
          "quoteCount": 1,
          "fixedCount": 7,
          "matchedCount": 0,
          "quoteOnlyCount": 0,
          "fixedOnlyCount": 0,
          "assemblyToPartsCount": 1,
          "assemblyPartCount": 7,
          "aligned": [
            {
              "itemKey": "2521188-1",
              "status": "assembly_to_parts",
              "mappingType": "assembly_to_parts",
              "quote": {
                "itemKey": "2521188-1",
                "partNumber": "2521188-1",
                "partName": "连接器总成",
                "unit": "SET",
                "quantity": 1,
                "rowNumbers": [
                  5
                ],
                "functions": [
                  "接ACCM端"
                ],
                "remarks": [
                  "TE"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "TE"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [
                  "2521188-1"
                ],
                "kind": "connector",
                "groupKey": "accm_end"
              },
              "fixed": null,
              "fixedParts": [
                {
                  "itemKey": "2509744-1",
                  "partNumber": "2509744-1",
                  "partName": "护套",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    5
                  ],
                  "functions": [
                    "（泰科，取消互锁，工具解锁）"
                  ],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105029"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A02105029"
                  ],
                  "assemblyRefs": [
                    "2521188-1 （泰科，取消互锁，工具解锁） 接ACCM端 适配4mm²屏蔽铜包铝交联铝导线"
                  ],
                  "kind": "connector",
                  "groupKey": "accm_end"
                },
                {
                  "itemKey": "2508246-1",
                  "partNumber": "2508246-1",
                  "partName": "链式-焊接端子",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    6
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03102426"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A03102426"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "accm_end"
                },
                {
                  "itemKey": "2474445-5",
                  "partNumber": "2474445-5",
                  "partName": "外屏蔽环",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    7
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03103031"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A03103031"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "accm_end"
                },
                {
                  "itemKey": "1-2350495-3",
                  "partNumber": "1-2350495-3",
                  "partName": "内屏蔽环",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    8
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03032325"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A03032325"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "accm_end"
                },
                {
                  "itemKey": "2519472-1",
                  "partNumber": "2519472-1",
                  "partName": "挡板",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    9
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105028"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A02105028"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "accm_end"
                },
                {
                  "itemKey": "2474450-5",
                  "partNumber": "2474450-5",
                  "partName": "密封圈",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    10
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02104232"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A02104232"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "accm_end"
                },
                {
                  "itemKey": "2474448-5",
                  "partNumber": "2474448-5",
                  "partName": "尾盖",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    11
                  ],
                  "functions": [],
                  "remarks": [
                    "TE"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02104233"
                  ],
                  "suppliers": [
                    "TE"
                  ],
                  "sapNos": [
                    "A02104233"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "accm_end"
                }
              ]
            }
          ]
        },
        {
          "key": "wires",
          "label": "导线",
          "section": "wire",
          "quoteCount": 1,
          "fixedCount": 1,
          "matchedCount": 0,
          "quoteOnlyCount": 1,
          "fixedOnlyCount": 1,
          "assemblyToPartsCount": 0,
          "assemblyPartCount": 0,
          "aligned": [
            {
              "itemKey": "FHLALR91XCCAATB91X/4.0/橙",
              "status": "quote_only",
              "quote": {
                "itemKey": "FHLALR91XCCAATB91X/4.0/橙",
                "partNumber": "FHLALR91XCCAATB91X/4.0/橙",
                "partName": "4.0mm²屏蔽镀锡铜包铝交联铝导线",
                "unit": "M",
                "quantity": 1.98,
                "rowNumbers": [
                  7
                ],
                "functions": [],
                "remarks": [
                  "太平洋/鑫宏业"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "太平洋/鑫宏业"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              },
              "fixed": null
            },
            {
              "itemKey": "FHLALR91XCCAATB91X/4.0/橙/AL8",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "FHLALR91XCCAATB91X/4.0/橙/AL8",
                "partNumber": "FHLALR91XCCAATB91X/4.0/橙/AL8",
                "partName": "4.0mm²屏蔽镀锡铜包铝交联铝导线",
                "unit": "M",
                "quantity": 1.98,
                "rowNumbers": [
                  19
                ],
                "functions": [],
                "remarks": [
                  "鑫宏业"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01103226"
                ],
                "suppliers": [
                  "鑫宏业"
                ],
                "sapNos": [
                  "A01103226"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            }
          ]
        },
        {
          "key": "sync_brackets",
          "label": "支架类（同步开发件）",
          "section": "sync",
          "quoteCount": 2,
          "fixedCount": 2,
          "matchedCount": 1,
          "quoteOnlyCount": 1,
          "fixedOnlyCount": 1,
          "assemblyToPartsCount": 0,
          "assemblyPartCount": 0,
          "aligned": [
            {
              "itemKey": "G281-HB-06",
              "status": "matched",
              "quote": {
                "itemKey": "G281-HB-06",
                "partNumber": "G281-HB-06",
                "partName": "塑料支架（带1个衬套）",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  9
                ],
                "functions": [],
                "remarks": [
                  "博昊/天久/华凯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "博昊/天久/华凯"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              },
              "fixed": {
                "itemKey": "G281-HB-06",
                "partNumber": "G281-HB-06",
                "partName": "塑料支架（带1个衬套）",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  21
                ],
                "functions": [],
                "remarks": [
                  "上海程达"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06102156"
                ],
                "suppliers": [
                  "上海程达"
                ],
                "sapNos": [
                  "A06102156"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              }
            },
            {
              "itemKey": "G281-ZJ-11",
              "status": "quote_only",
              "quote": {
                "itemKey": "G281-ZJ-11",
                "partNumber": "G281-ZJ-11",
                "partName": "金属支架",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  10
                ],
                "functions": [],
                "remarks": [
                  "恒伟林/贵龙/华凯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "恒伟林/贵龙/华凯"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              },
              "fixed": null
            },
            {
              "itemKey": "G281-HB-10",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "G281-HB-10",
                "partNumber": "G281-HB-10",
                "partName": "塑料支架（带卡扣）",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  22
                ],
                "functions": [
                  "金属支架G281-ZJ-11"
                ],
                "remarks": [
                  "/"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "/"
                ],
                "sapNos": [],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              }
            }
          ]
        },
        {
          "key": "materials",
          "label": "其他物料",
          "section": "material",
          "quoteCount": 6,
          "fixedCount": 7,
          "matchedCount": 5,
          "quoteOnlyCount": 1,
          "fixedOnlyCount": 2,
          "assemblyToPartsCount": 0,
          "assemblyPartCount": 0,
          "aligned": [
            {
              "itemKey": "LG3305D012B",
              "status": "matched",
              "quote": {
                "itemKey": "LG3305D012B",
                "partNumber": "LG3305D012B",
                "partName": "12OR橙色波纹管",
                "unit": "M",
                "quantity": 0.8,
                "rowNumbers": [
                  8
                ],
                "functions": [],
                "remarks": [
                  "骏鼎达/诗兰姆"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101161"
                ],
                "suppliers": [
                  "骏鼎达/诗兰姆"
                ],
                "sapNos": [
                  "A04101161"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "LG3305D012B",
                "partNumber": "LG3305D012B",
                "partName": "12OR橙色波纹管",
                "unit": "M",
                "quantity": 0.82,
                "rowNumbers": [
                  20
                ],
                "functions": [],
                "remarks": [
                  "骏鼎达"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101161"
                ],
                "suppliers": [
                  "骏鼎达"
                ],
                "sapNos": [
                  "A04101161"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "LY5016019-OR2",
              "status": "matched",
              "quote": {
                "itemKey": "LY5016019-OR2",
                "partNumber": "LY5016019-OR2",
                "partName": "橙色布基胶带",
                "unit": "M",
                "quantity": 1,
                "rowNumbers": [
                  11
                ],
                "functions": [],
                "remarks": [
                  "联益"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101159"
                ],
                "suppliers": [
                  "联益"
                ],
                "sapNos": [
                  "A04101159"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "LY5016019-OR2",
                "partNumber": "LY5016019-OR2",
                "partName": "橙色布基胶带",
                "unit": "M",
                "quantity": 1,
                "rowNumbers": [
                  23
                ],
                "functions": [],
                "remarks": [
                  "联益"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101159"
                ],
                "suppliers": [
                  "联益"
                ],
                "sapNos": [
                  "A04101159"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "P111W0192510002",
              "status": "quote_only",
              "quote": {
                "itemKey": "P111W0192510002",
                "partNumber": "P111W0192510002",
                "partName": "橙色PVC胶带",
                "unit": "M",
                "quantity": 2,
                "rowNumbers": [
                  12
                ],
                "functions": [],
                "remarks": [
                  "亚化"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101670"
                ],
                "suppliers": [
                  "亚化"
                ],
                "sapNos": [
                  "A04101670"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": null
            },
            {
              "itemKey": "PP9104320",
              "status": "matched",
              "quote": {
                "itemKey": "PP9104320",
                "partNumber": "PP9104320",
                "partName": "7*12箭头扎带",
                "unit": "PCS",
                "quantity": 3,
                "rowNumbers": [
                  13
                ],
                "functions": [],
                "remarks": [
                  "上海众安/海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06101606"
                ],
                "suppliers": [
                  "上海众安/海尔曼太通"
                ],
                "sapNos": [
                  "A06101606"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "PP9104320",
                "partNumber": "PP9104320",
                "partName": "7*12箭头扎带",
                "unit": "PCS",
                "quantity": 3,
                "rowNumbers": [
                  25
                ],
                "functions": [],
                "remarks": [
                  "上海众安"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06101606"
                ],
                "suppliers": [
                  "上海众安"
                ],
                "sapNos": [
                  "A06101606"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "111-00563",
              "status": "matched",
              "quote": {
                "itemKey": "111-00563",
                "partNumber": "111-00563",
                "partName": "扎带绳",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  14
                ],
                "functions": [],
                "remarks": [
                  "上海众安/海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06010012"
                ],
                "suppliers": [
                  "上海众安/海尔曼太通"
                ],
                "sapNos": [
                  "A06010012"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "111-00563",
                "partNumber": "111-00563",
                "partName": "扎带绳",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  26
                ],
                "functions": [],
                "remarks": [
                  "海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06010012"
                ],
                "suppliers": [
                  "海尔曼太通"
                ],
                "sapNos": [
                  "A06010012"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "X1-BQ-01标签140X30MM",
              "status": "matched",
              "quote": {
                "itemKey": "X1-BQ-01标签140X30MM",
                "partNumber": "X1-BQ-01 标签140x30mm",
                "partName": "产品标签",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  15
                ],
                "functions": [],
                "remarks": [
                  "洪众"
                ],
                "otherRemarks": [],
                "wireNos": [
                  "70002326"
                ],
                "suppliers": [
                  "洪众"
                ],
                "sapNos": [
                  "70002326"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "X1-BQ-01标签140X30MM",
                "partNumber": "X1-BQ-01 标签140x30mm",
                "partName": "产品标签",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  27
                ],
                "functions": [],
                "remarks": [
                  "洪众"
                ],
                "otherRemarks": [],
                "wireNos": [
                  "70002326"
                ],
                "suppliers": [
                  "洪众"
                ],
                "sapNos": [
                  "70002326"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "1806416",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "1806416",
                "partNumber": "1806416",
                "partName": "4方盲堵(红色)",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  18
                ],
                "functions": [],
                "remarks": [
                  "菲尼克斯"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "A02105022"
                ],
                "suppliers": [
                  "菲尼克斯"
                ],
                "sapNos": [
                  "A02105022"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "P111W0192510003",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "P111W0192510003",
                "partNumber": "P111W0192510003",
                "partName": "橙色PVC胶带",
                "unit": "M",
                "quantity": 2,
                "rowNumbers": [
                  24
                ],
                "functions": [],
                "remarks": [
                  "亚化"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101791"
                ],
                "suppliers": [
                  "亚化"
                ],
                "sapNos": [
                  "A04101791"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            }
          ]
        }
      ]
    },
    "6608544875": {
      "harnessId": "6608544875",
      "harnessName": "前驱直流母线",
      "quoteSheet": "6608544875",
      "fixedSheet": "6608544875-25方",
      "sources": {
        "quote": {
          "sheet": "6608544875",
          "itemCount": 15
        },
        "fixed": {
          "sheet": "6608544875-25方",
          "itemCount": 29
        }
      },
      "summary": {
        "groupCount": 7,
        "connectorGroupCount": 3,
        "syncGroupCount": 2,
        "quoteItemCount": 15,
        "fixedItemCount": 29,
        "matchedCount": 11,
        "quoteOnlyCount": 2,
        "fixedOnlyCount": 3,
        "assemblyToPartsCount": 2,
        "assemblyPartCount": 15,
        "wireMatchedCount": 0,
        "syncMatchedCount": 6,
        "materialMatchedCount": 11
      },
      "groups": [
        {
          "key": "battery_end",
          "label": "接电池端",
          "section": "connector",
          "quoteCount": 1,
          "fixedCount": 8,
          "matchedCount": 0,
          "quoteOnlyCount": 0,
          "fixedOnlyCount": 0,
          "assemblyToPartsCount": 1,
          "assemblyPartCount": 8,
          "aligned": [
            {
              "itemKey": "HVPC2P1600FV550-NH-P010",
              "status": "assembly_to_parts",
              "mappingType": "assembly_to_parts",
              "quote": {
                "itemKey": "HVPC2P1600FV550-NH-P010",
                "partNumber": "HVPC2P1600FV550-NH-P010",
                "partName": "连接器总成",
                "unit": "SET",
                "quantity": 1,
                "rowNumbers": [
                  5
                ],
                "functions": [
                  "接电池端"
                ],
                "remarks": [
                  "安费诺"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "安费诺"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [
                  "HVPC2P1600FV550-NH-P010"
                ],
                "kind": "connector",
                "groupKey": "battery_end"
              },
              "fixed": null,
              "fixedParts": [
                {
                  "itemKey": "HVPC2P1600FT5-NH-MP010",
                  "partNumber": "HVPC2P1600FT5-NH-MP010",
                  "partName": "护套（145度反装 A键位）",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    5
                  ],
                  "functions": [
                    "接电池端"
                  ],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105032"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02105032"
                  ],
                  "assemblyRefs": [
                    "HVPC2P1600FT525-NH-P010 接电池端 适配2*25mm²屏蔽铜包铝硅胶铜导线"
                  ],
                  "kind": "connector",
                  "groupKey": "battery_end"
                },
                {
                  "itemKey": "HVPC2P1600FT-09P010",
                  "partNumber": "HVPC2P1600FT-09P010",
                  "partName": "插头端子-单粒焊接",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    6
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03103389"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A03103389"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "battery_end"
                },
                {
                  "itemKey": "HVPC2P1600FV-15P010",
                  "partNumber": "HVPC2P1600FV-15P010",
                  "partName": "挡板",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    7
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02104375"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02104375"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "battery_end"
                },
                {
                  "itemKey": "HVPC2P1600FV-06-25P010",
                  "partNumber": "HVPC2P1600FV-06-25P010",
                  "partName": "插头外屏蔽环",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    8
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03103387"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A03103387"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "battery_end"
                },
                {
                  "itemKey": "HVPC2P1800FS-11-25P010",
                  "partNumber": "HVPC2P1800FS-11-25P010",
                  "partName": "插头屏蔽内环",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    9
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03103409"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A03103409"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "battery_end"
                },
                {
                  "itemKey": "HVPC2P1600FV-12-25P010",
                  "partNumber": "HVPC2P1600FV-12-25P010",
                  "partName": "插头线束密封圈",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    10
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105062"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02105062"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "battery_end"
                },
                {
                  "itemKey": "HVPC2P1600FV-11-25P010",
                  "partNumber": "HVPC2P1600FV-11-25P010",
                  "partName": "插头线卡",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    11
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105060"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02105060"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "battery_end"
                },
                {
                  "itemKey": "HVPC2P1600FV-10-25P010",
                  "partNumber": "HVPC2P1600FV-10-25P010",
                  "partName": "插头尾盖",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    12
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105061"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02105061"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "battery_end"
                }
              ]
            }
          ]
        },
        {
          "key": "edrive_end",
          "label": "接电驱端",
          "section": "connector",
          "quoteCount": 1,
          "fixedCount": 7,
          "matchedCount": 0,
          "quoteOnlyCount": 0,
          "fixedOnlyCount": 0,
          "assemblyToPartsCount": 1,
          "assemblyPartCount": 7,
          "aligned": [
            {
              "itemKey": "IPT2PFS050-S02P010",
              "status": "assembly_to_parts",
              "mappingType": "assembly_to_parts",
              "quote": {
                "itemKey": "IPT2PFS050-S02P010",
                "partNumber": "IPT2PFS050-S02P010",
                "partName": "IPT连接器总成（带焊接端子）",
                "unit": "SET",
                "quantity": 1,
                "rowNumbers": [
                  6
                ],
                "functions": [
                  "接电驱"
                ],
                "remarks": [
                  "安费诺"
                ],
                "otherRemarks": [
                  "客户指定"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "安费诺"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [
                  "IPT2PFS050-S02P010"
                ],
                "kind": "connector",
                "groupKey": "edrive_end"
              },
              "fixed": null,
              "fixedParts": [
                {
                  "itemKey": "IPT3P-01-06",
                  "partNumber": "IPT3P-01-06",
                  "partName": "特殊屏蔽件",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    14
                  ],
                  "functions": [
                    "接电驱端"
                  ],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02030991"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02030991"
                  ],
                  "assemblyRefs": [
                    "IPT2P25P001-P010（安费诺 不含端子） 接电驱端 适配2*25mm²屏蔽铜包铝硅胶铜导线"
                  ],
                  "kind": "connector",
                  "groupKey": "edrive_end"
                },
                {
                  "itemKey": "IPT3P-01-19",
                  "partNumber": "IPT3P-01-19",
                  "partName": "25mm2 屏蔽外环",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    15
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03103408"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A03103408"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "edrive_end"
                },
                {
                  "itemKey": "IPT3P-01-20",
                  "partNumber": "IPT3P-01-20",
                  "partName": "25mm2 屏蔽内环",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    16
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A03103407"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A03103407"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "edrive_end"
                },
                {
                  "itemKey": "IPT3P-01-21",
                  "partNumber": "IPT3P-01-21",
                  "partName": "护套密封圈",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    17
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02030990"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02030990"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "edrive_end"
                },
                {
                  "itemKey": "IPT2PP-01-01",
                  "partNumber": "IPT2PP-01-01",
                  "partName": "护套主体",
                  "unit": "PCS",
                  "quantity": 1,
                  "rowNumbers": [
                    18
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02031898"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02031898"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "edrive_end"
                },
                {
                  "itemKey": "IPT3P-01-18",
                  "partNumber": "IPT3P-01-18",
                  "partName": "25mm2 线密封圈",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    19
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105058"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02105058"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "edrive_end"
                },
                {
                  "itemKey": "IPT3P-01-16",
                  "partNumber": "IPT3P-01-16",
                  "partName": "25mm2 尾盖",
                  "unit": "PCS",
                  "quantity": 2,
                  "rowNumbers": [
                    20
                  ],
                  "functions": [],
                  "remarks": [
                    "安费诺"
                  ],
                  "otherRemarks": [
                    "客户指定"
                  ],
                  "wireNos": [
                    "A02105059"
                  ],
                  "suppliers": [
                    "安费诺"
                  ],
                  "sapNos": [
                    "A02105059"
                  ],
                  "assemblyRefs": [],
                  "kind": "connector",
                  "groupKey": "edrive_end"
                }
              ]
            }
          ]
        },
        {
          "key": "connector_misc",
          "label": "其他连接器",
          "section": "connector",
          "quoteCount": 0,
          "fixedCount": 1,
          "matchedCount": 0,
          "quoteOnlyCount": 0,
          "fixedOnlyCount": 1,
          "assemblyToPartsCount": 0,
          "assemblyPartCount": 0,
          "aligned": [
            {
              "itemKey": "1-2177380-1",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "1-2177380-1",
                "partNumber": "1-2177380-1",
                "partName": "IPT 压接端子",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  13
                ],
                "functions": [
                  "IPT 压接端子"
                ],
                "remarks": [
                  "泰科"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A03000392"
                ],
                "suppliers": [
                  "泰科"
                ],
                "sapNos": [
                  "A03000392"
                ],
                "assemblyRefs": [
                  "IPT 压接端子"
                ],
                "kind": "connector",
                "groupKey": "connector_misc"
              }
            }
          ]
        },
        {
          "key": "wires",
          "label": "导线",
          "section": "wire",
          "quoteCount": 1,
          "fixedCount": 1,
          "matchedCount": 0,
          "quoteOnlyCount": 1,
          "fixedOnlyCount": 1,
          "assemblyToPartsCount": 0,
          "assemblyPartCount": 0,
          "aligned": [
            {
              "itemKey": "FHLR2GCCAATB2G/35.0/橙",
              "status": "quote_only",
              "quote": {
                "itemKey": "FHLR2GCCAATB2G/35.0/橙",
                "partNumber": "FHLR2GCCAATB2G/35.0/橙",
                "partName": "35mm²屏蔽镀锡铜包铝硅胶铜导线",
                "unit": "M",
                "quantity": 2.4,
                "rowNumbers": [
                  8
                ],
                "functions": [],
                "remarks": [
                  "鑫宏业/斯普乐"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "鑫宏业/斯普乐"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              },
              "fixed": null
            },
            {
              "itemKey": "FHLR2GCCAATB2G/25.0/橙",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "FHLR2GCCAATB2G/25.0/橙",
                "partNumber": "FHLR2GCCAATB2G/25.0/橙",
                "partName": "25mm²屏蔽镀锡铜包铝硅胶铜导线",
                "unit": "M",
                "quantity": 2.43,
                "rowNumbers": [
                  22
                ],
                "functions": [],
                "remarks": [
                  "鑫宏业"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A01103233"
                ],
                "suppliers": [
                  "鑫宏业"
                ],
                "sapNos": [
                  "A01103233"
                ],
                "assemblyRefs": [],
                "kind": "wire",
                "groupKey": "wires"
              }
            }
          ]
        },
        {
          "key": "sync_brackets",
          "label": "支架类（同步开发件）",
          "section": "sync",
          "quoteCount": 4,
          "fixedCount": 4,
          "matchedCount": 4,
          "quoteOnlyCount": 0,
          "fixedOnlyCount": 0,
          "assemblyToPartsCount": 0,
          "assemblyPartCount": 0,
          "aligned": [
            {
              "itemKey": "G281-HB-05",
              "status": "matched",
              "quote": {
                "itemKey": "G281-HB-05",
                "partNumber": "G281-HB-05",
                "partName": "塑料支架（带2个衬套）",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  11
                ],
                "functions": [],
                "remarks": [
                  "博昊/天久/华凯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "博昊/天久/华凯"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              },
              "fixed": {
                "itemKey": "G281-HB-05",
                "partNumber": "G281-HB-05",
                "partName": "塑料支架（带2个衬套）",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  25
                ],
                "functions": [],
                "remarks": [
                  "上海程达"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06102154"
                ],
                "suppliers": [
                  "上海程达"
                ],
                "sapNos": [
                  "A06102154"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              }
            },
            {
              "itemKey": "G281-ZJ-08",
              "status": "matched",
              "quote": {
                "itemKey": "G281-ZJ-08",
                "partNumber": "G281-ZJ-08",
                "partName": "金属支架",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  12
                ],
                "functions": [],
                "remarks": [
                  "恒伟林/贵龙/华凯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "恒伟林/贵龙/华凯"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              },
              "fixed": {
                "itemKey": "G281-ZJ-08",
                "partNumber": "G281-ZJ-08",
                "partName": "金属支架",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  26
                ],
                "functions": [],
                "remarks": [
                  "贵龙"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06102148"
                ],
                "suppliers": [
                  "贵龙"
                ],
                "sapNos": [
                  "A06102148"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              }
            },
            {
              "itemKey": "G281-ZJ-09",
              "status": "matched",
              "quote": {
                "itemKey": "G281-ZJ-09",
                "partNumber": "G281-ZJ-09",
                "partName": "金属支架",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  13
                ],
                "functions": [],
                "remarks": [
                  "恒伟林/贵龙/华凯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "恒伟林/贵龙/华凯"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              },
              "fixed": {
                "itemKey": "G281-ZJ-09",
                "partNumber": "G281-ZJ-09",
                "partName": "金属支架",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  27
                ],
                "functions": [],
                "remarks": [
                  "贵龙"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06102144"
                ],
                "suppliers": [
                  "贵龙"
                ],
                "sapNos": [
                  "A06102144"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              }
            },
            {
              "itemKey": "G281-ZJ-10",
              "status": "matched",
              "quote": {
                "itemKey": "G281-ZJ-10",
                "partNumber": "G281-ZJ-10",
                "partName": "金属支架",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  14
                ],
                "functions": [],
                "remarks": [
                  "恒伟林/贵龙/华凯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "恒伟林/贵龙/华凯"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              },
              "fixed": {
                "itemKey": "G281-ZJ-10",
                "partNumber": "G281-ZJ-10",
                "partName": "金属支架",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  28
                ],
                "functions": [],
                "remarks": [
                  "华凯"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06102143"
                ],
                "suppliers": [
                  "华凯"
                ],
                "sapNos": [
                  "A06102143"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_brackets"
              }
            }
          ]
        },
        {
          "key": "sync_rubber",
          "label": "橡胶件类（同步开发件）",
          "section": "sync",
          "quoteCount": 2,
          "fixedCount": 2,
          "matchedCount": 2,
          "quoteOnlyCount": 0,
          "fixedOnlyCount": 0,
          "assemblyToPartsCount": 0,
          "assemblyPartCount": 0,
          "aligned": [
            {
              "itemKey": "G281-XJ-07",
              "status": "matched",
              "quote": {
                "itemKey": "G281-XJ-07",
                "partNumber": "G281-XJ-07",
                "partName": "橡胶件",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  15
                ],
                "functions": [],
                "remarks": [
                  "恒伟林/远信/博昊/天乐"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "恒伟林/远信/博昊/天乐"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_rubber"
              },
              "fixed": {
                "itemKey": "G281-XJ-07",
                "partNumber": "G281-XJ-07",
                "partName": "橡胶件",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  29
                ],
                "functions": [],
                "remarks": [
                  "博昊"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "博昊"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_rubber"
              }
            },
            {
              "itemKey": "G281-XJ-08",
              "status": "matched",
              "quote": {
                "itemKey": "G281-XJ-08",
                "partNumber": "G281-XJ-08",
                "partName": "橡胶件",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  16
                ],
                "functions": [],
                "remarks": [
                  "恒伟林/远信/博昊/天乐"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "恒伟林/远信/博昊/天乐"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_rubber"
              },
              "fixed": {
                "itemKey": "G281-XJ-08",
                "partNumber": "G281-XJ-08",
                "partName": "橡胶件",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  30
                ],
                "functions": [],
                "remarks": [
                  "博昊"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "/"
                ],
                "suppliers": [
                  "博昊"
                ],
                "sapNos": [
                  "/"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "sync_rubber"
              }
            }
          ]
        },
        {
          "key": "materials",
          "label": "其他物料",
          "section": "material",
          "quoteCount": 6,
          "fixedCount": 6,
          "matchedCount": 5,
          "quoteOnlyCount": 1,
          "fixedOnlyCount": 1,
          "assemblyToPartsCount": 0,
          "assemblyPartCount": 0,
          "aligned": [
            {
              "itemKey": "HS-125(2X)N20-30",
              "status": "quote_only",
              "quote": {
                "itemKey": "HS-125(2X)N20-30",
                "partNumber": "HS-125(2X)N20-30",
                "partName": "不带胶-热缩管",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  7
                ],
                "functions": [],
                "remarks": [
                  "深圳宏商/长春海达"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04030275"
                ],
                "suppliers": [
                  "深圳宏商/长春海达"
                ],
                "sapNos": [
                  "A04030275"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": null
            },
            {
              "itemKey": "SCS2165A016",
              "status": "matched",
              "quote": {
                "itemKey": "SCS2165A016",
                "partNumber": "SCS2165A016",
                "partName": "16OR橙色编织套管",
                "unit": "M",
                "quantity": 1.95,
                "rowNumbers": [
                  9
                ],
                "functions": [],
                "remarks": [
                  "骏鼎达/明鑫"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101476"
                ],
                "suppliers": [
                  "骏鼎达/明鑫"
                ],
                "sapNos": [
                  "A04101476"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "SCS2165A016",
                "partNumber": "SCS2165A016",
                "partName": "16OR橙色编织套管",
                "unit": "M",
                "quantity": 2.01,
                "rowNumbers": [
                  23
                ],
                "functions": [],
                "remarks": [
                  "骏鼎达"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101476"
                ],
                "suppliers": [
                  "骏鼎达"
                ],
                "sapNos": [
                  "A04101476"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "LY5016019-OR2",
              "status": "matched",
              "quote": {
                "itemKey": "LY5016019-OR2",
                "partNumber": "LY5016019-OR2",
                "partName": "橙色布基胶带",
                "unit": "M",
                "quantity": 4,
                "rowNumbers": [
                  10
                ],
                "functions": [],
                "remarks": [
                  "联益"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101159"
                ],
                "suppliers": [
                  "联益"
                ],
                "sapNos": [
                  "A04101159"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "LY5016019-OR2",
                "partNumber": "LY5016019-OR2",
                "partName": "橙色布基胶带",
                "unit": "M",
                "quantity": 4,
                "rowNumbers": [
                  24
                ],
                "functions": [],
                "remarks": [
                  "联益"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04101159"
                ],
                "suppliers": [
                  "联益"
                ],
                "sapNos": [
                  "A04101159"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "111-00563",
              "status": "matched",
              "quote": {
                "itemKey": "111-00563",
                "partNumber": "111-00563",
                "partName": "扎带绳",
                "unit": "PCS",
                "quantity": 4,
                "rowNumbers": [
                  17
                ],
                "functions": [],
                "remarks": [
                  "上海众安/海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06010012"
                ],
                "suppliers": [
                  "上海众安/海尔曼太通"
                ],
                "sapNos": [
                  "A06010012"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "111-00563",
                "partNumber": "111-00563",
                "partName": "扎带绳",
                "unit": "PCS",
                "quantity": 6,
                "rowNumbers": [
                  31
                ],
                "functions": [],
                "remarks": [
                  "海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06010012"
                ],
                "suppliers": [
                  "海尔曼太通"
                ],
                "sapNos": [
                  "A06010012"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "108-00150",
              "status": "matched",
              "quote": {
                "itemKey": "108-00150",
                "partNumber": "108-00150",
                "partName": "扎带绳",
                "unit": "PCS",
                "quantity": 3,
                "rowNumbers": [
                  18
                ],
                "functions": [],
                "remarks": [
                  "上海众安/海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06100602"
                ],
                "suppliers": [
                  "上海众安/海尔曼太通"
                ],
                "sapNos": [
                  "A06100602"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "108-00150",
                "partNumber": "108-00150",
                "partName": "扎带绳",
                "unit": "PCS",
                "quantity": 3,
                "rowNumbers": [
                  32
                ],
                "functions": [],
                "remarks": [
                  "海尔曼太通"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A06100602"
                ],
                "suppliers": [
                  "海尔曼太通"
                ],
                "sapNos": [
                  "A06100602"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "X1-BQ-01标签140X30MM",
              "status": "matched",
              "quote": {
                "itemKey": "X1-BQ-01标签140X30MM",
                "partNumber": "X1-BQ-01 标签140x30mm",
                "partName": "产品标签",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  19
                ],
                "functions": [],
                "remarks": [
                  "洪众"
                ],
                "otherRemarks": [],
                "wireNos": [
                  "70002326"
                ],
                "suppliers": [
                  "洪众"
                ],
                "sapNos": [
                  "70002326"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              },
              "fixed": {
                "itemKey": "X1-BQ-01标签140X30MM",
                "partNumber": "X1-BQ-01 标签140x30mm",
                "partName": "产品标签",
                "unit": "PCS",
                "quantity": 1,
                "rowNumbers": [
                  33
                ],
                "functions": [],
                "remarks": [
                  "洪众"
                ],
                "otherRemarks": [],
                "wireNos": [
                  "70002326"
                ],
                "suppliers": [
                  "洪众"
                ],
                "sapNos": [
                  "70002326"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            },
            {
              "itemKey": "HS-125(3X)18-30",
              "status": "fixed_only",
              "quote": null,
              "fixed": {
                "itemKey": "HS-125(3X)18-30",
                "partNumber": "HS-125(3X) 18-30",
                "partName": "不带胶-热缩管",
                "unit": "PCS",
                "quantity": 2,
                "rowNumbers": [
                  21
                ],
                "functions": [],
                "remarks": [
                  "长春海达"
                ],
                "otherRemarks": [
                  "★"
                ],
                "wireNos": [
                  "A04102622"
                ],
                "suppliers": [
                  "长春海达"
                ],
                "sapNos": [
                  "A04102622"
                ],
                "assemblyRefs": [],
                "kind": "material",
                "groupKey": "materials"
              }
            }
          ]
        }
      ]
    }
  },
  "unmatchedHarnesses": []
},
  connectorProtocolStatus: {
  "meta": {
    "sourceWorkbook": "G281_protocol_price.xlsx",
    "sheetName": "assembly_part_list",
    "generatedAt": "2026-03-26T01:48:45+08:00",
    "scopeNote": "Top-level rows with Function filled, including IPT crimp terminal.",
    "portfolioRule": "confirmed_to_protocol_partial_to_progress_else_sample",
    "portfolioRuleNote": "Initialization rule: fully confirmed aggregated connectors switch to protocol pricing, partially confirmed aggregated connectors switch to progress pricing, and the rest switch to sample pricing while keeping manual per-item override available."
  },
  "summary": {
    "totalRows": 20,
    "confirmed": 8,
    "quotedPending": 6,
    "noReply": 5,
    "devPending": 1,
    "portfolioRecommendationCounts": {
      "protocol": 2,
      "progress": 3,
      "sample": 6
    }
  },
  "portfolios": [
    {
      "portfolioId": "battery_end_hv",
      "portfolioName": "battery_end_hv",
      "sourceCount": 4,
      "mappedRowKeys": ["r001", "r016", "r024", "r129"],
      "statusCounts": {
        "confirmed": 1,
        "quoted_pending": 2,
        "no_reply": 0,
        "dev_pending": 1
      },
      "recommendedStage": "progress"
    },
    {
      "portfolioId": "edrive_end_hv",
      "portfolioName": "edrive_end_hv",
      "sourceCount": 3,
      "mappedRowKeys": ["r009", "r033", "r065"],
      "statusCounts": {
        "confirmed": 1,
        "quoted_pending": 2,
        "no_reply": 0,
        "dev_pending": 0
      },
      "recommendedStage": "progress"
    },
    {
      "portfolioId": "accm_end",
      "portfolioName": "accm_end",
      "sourceCount": 1,
      "mappedRowKeys": ["r040"],
      "statusCounts": {
        "confirmed": 1,
        "quoted_pending": 0,
        "no_reply": 0,
        "dev_pending": 0
      },
      "recommendedStage": "protocol"
    },
    {
      "portfolioId": "ptc_end",
      "portfolioName": "ptc_end",
      "sourceCount": 2,
      "mappedRowKeys": ["r058", "r125"],
      "statusCounts": {
        "confirmed": 1,
        "quoted_pending": 1,
        "no_reply": 0,
        "dev_pending": 0
      },
      "recommendedStage": "progress"
    },
    {
      "portfolioId": "charge_socket_main",
      "portfolioName": "charge_socket_main",
      "sourceCount": 4,
      "mappedRowKeys": ["r072", "r108", "r114", "r119"],
      "statusCounts": {
        "confirmed": 4,
        "quoted_pending": 0,
        "no_reply": 0,
        "dev_pending": 0
      },
      "recommendedStage": "protocol"
    },
    {
      "portfolioId": "dc_charge_lv",
      "portfolioName": "dc_charge_lv",
      "sourceCount": 1,
      "mappedRowKeys": ["r090"],
      "statusCounts": {
        "confirmed": 0,
        "quoted_pending": 0,
        "no_reply": 1,
        "dev_pending": 0
      },
      "recommendedStage": "sample"
    },
    {
      "portfolioId": "ac_charge_lv",
      "portfolioName": "ac_charge_lv",
      "sourceCount": 1,
      "mappedRowKeys": ["r093"],
      "statusCounts": {
        "confirmed": 0,
        "quoted_pending": 0,
        "no_reply": 1,
        "dev_pending": 0
      },
      "recommendedStage": "sample"
    },
    {
      "portfolioId": "electronic_lock",
      "portfolioName": "electronic_lock",
      "sourceCount": 1,
      "mappedRowKeys": ["r097"],
      "statusCounts": {
        "confirmed": 0,
        "quoted_pending": 0,
        "no_reply": 1,
        "dev_pending": 0
      },
      "recommendedStage": "sample"
    },
    {
      "portfolioId": "low_voltage_inline",
      "portfolioName": "low_voltage_inline",
      "sourceCount": 1,
      "mappedRowKeys": ["r100"],
      "statusCounts": {
        "confirmed": 0,
        "quoted_pending": 0,
        "no_reply": 1,
        "dev_pending": 0
      },
      "recommendedStage": "sample"
    },
    {
      "portfolioId": "branch_splitter",
      "portfolioName": "branch_splitter",
      "sourceCount": 1,
      "mappedRowKeys": ["r047"],
      "statusCounts": {
        "confirmed": 0,
        "quoted_pending": 1,
        "no_reply": 0,
        "dev_pending": 0
      },
      "recommendedStage": "sample"
    },
    {
      "portfolioId": "misc_terminal_set",
      "portfolioName": "misc_terminal_set",
      "sourceCount": 1,
      "mappedRowKeys": ["r032"],
      "statusCounts": {
        "confirmed": 0,
        "quoted_pending": 0,
        "no_reply": 1,
        "dev_pending": 0
      },
      "recommendedStage": "sample"
    }
  ],
  "rows": [
    {
      "rowKey": "r001",
      "sequence": 1,
      "sourceRow": 2,
      "portfolioId": "battery_end_hv",
      "groupLabel": "Battery end / 2x35",
      "partNumber": "HVPC2P1600FT5-NH-MP010",
      "partName": "Cover 45deg reverse Code A",
      "supplier": "Amphenol",
      "targetProtocolPrice": 23.0,
      "replyPrice": null,
      "supplierReply": "OK",
      "statusKey": "confirmed",
      "statusLabel": "confirmed",
      "recommendedStage": "protocol",
      "difference": null
    },
    {
      "rowKey": "r009",
      "sequence": 9,
      "sourceRow": 10,
      "portfolioId": "edrive_end_hv",
      "groupLabel": "E-drive end / 2x35",
      "partNumber": "N022525276C",
      "partName": "Welded terminal 70",
      "supplier": "Amphenol",
      "targetProtocolPrice": 17.0,
      "replyPrice": 21.0,
      "supplierReply": "21",
      "statusKey": "quoted_pending",
      "statusLabel": "quoted_pending",
      "recommendedStage": "sample",
      "difference": 4.0
    },
    {
      "rowKey": "r016",
      "sequence": 16,
      "sourceRow": 17,
      "portfolioId": "battery_end_hv",
      "groupLabel": "Battery end / 2x35 / 90deg",
      "partNumber": "HVPC2P1600FV5-NH-M-P010",
      "partName": "Cover 90deg reverse Code A",
      "supplier": "Amphenol",
      "targetProtocolPrice": 21.0,
      "replyPrice": 22.0,
      "supplierReply": "22",
      "statusKey": "quoted_pending",
      "statusLabel": "quoted_pending",
      "recommendedStage": "sample",
      "difference": 1.0
    },
    {
      "rowKey": "r024",
      "sequence": 24,
      "sourceRow": 25,
      "portfolioId": "battery_end_hv",
      "groupLabel": "Battery end / 2x25",
      "partNumber": "HVPC2P1600FT5-NH-MP010",
      "partName": "Cover 45deg reverse Code A",
      "supplier": "Amphenol",
      "targetProtocolPrice": 21.0,
      "replyPrice": 23.0,
      "supplierReply": "23",
      "statusKey": "quoted_pending",
      "statusLabel": "quoted_pending",
      "recommendedStage": "sample",
      "difference": 2.0
    },
    {
      "rowKey": "r032",
      "sequence": 32,
      "sourceRow": 33,
      "portfolioId": "misc_terminal_set",
      "groupLabel": "IPT terminal",
      "partNumber": "1-2177380-1",
      "partName": "IPT crimp terminal",
      "supplier": "TE",
      "targetProtocolPrice": null,
      "replyPrice": null,
      "supplierReply": "",
      "statusKey": "no_reply",
      "statusLabel": "no_reply",
      "recommendedStage": "sample",
      "difference": null
    },
    {
      "rowKey": "r033",
      "sequence": 33,
      "sourceRow": 34,
      "portfolioId": "edrive_end_hv",
      "groupLabel": "E-drive end / 2x25",
      "partNumber": "IPT3P-01-06",
      "partName": "Special shield part",
      "supplier": "Amphenol",
      "targetProtocolPrice": 9.0,
      "replyPrice": 12.5,
      "supplierReply": "12.5",
      "statusKey": "quoted_pending",
      "statusLabel": "quoted_pending",
      "recommendedStage": "sample",
      "difference": 3.5
    },
    {
      "rowKey": "r040",
      "sequence": 40,
      "sourceRow": 41,
      "portfolioId": "accm_end",
      "groupLabel": "ACCM end",
      "partNumber": "2509744-1",
      "partName": "Cover",
      "supplier": "TE",
      "targetProtocolPrice": 10.0,
      "replyPrice": null,
      "supplierReply": "OK",
      "statusKey": "confirmed",
      "statusLabel": "confirmed",
      "recommendedStage": "protocol",
      "difference": null
    },
    {
      "rowKey": "r047",
      "sequence": 47,
      "sourceRow": 48,
      "portfolioId": "branch_splitter",
      "groupLabel": "Branch splitter",
      "partNumber": "F02-372010-B04",
      "partName": "Left end cap",
      "supplier": "Bada",
      "targetProtocolPrice": 16.0,
      "replyPrice": 18.0,
      "supplierReply": "18",
      "statusKey": "quoted_pending",
      "statusLabel": "quoted_pending",
      "recommendedStage": "sample",
      "difference": 2.0
    },
    {
      "rowKey": "r058",
      "sequence": 58,
      "sourceRow": 59,
      "portfolioId": "ptc_end",
      "groupLabel": "PTC end / TE",
      "partNumber": "1-2509498-1",
      "partName": "Cover",
      "supplier": "TE",
      "targetProtocolPrice": 9.0,
      "replyPrice": 10.5,
      "supplierReply": "10.5",
      "statusKey": "quoted_pending",
      "statusLabel": "quoted_pending",
      "recommendedStage": "sample",
      "difference": 1.5
    },
    {
      "rowKey": "r065",
      "sequence": 65,
      "sourceRow": 66,
      "portfolioId": "edrive_end_hv",
      "groupLabel": "E-drive end / 4mm",
      "partNumber": "1890945",
      "partName": "Half-finished plug cover",
      "supplier": "Phoenix",
      "targetProtocolPrice": 26.35,
      "replyPrice": null,
      "supplierReply": "OK",
      "statusKey": "confirmed",
      "statusLabel": "confirmed",
      "recommendedStage": "protocol",
      "difference": null
    },
    {
      "rowKey": "r072",
      "sequence": 72,
      "sourceRow": 73,
      "portfolioId": "charge_socket_main",
      "groupLabel": "Charge socket / main assembly",
      "partNumber": "2519063-1",
      "partName": "Dust cover assembly",
      "supplier": "TE",
      "targetProtocolPrice": 150.0,
      "replyPrice": null,
      "supplierReply": "OK",
      "statusKey": "confirmed",
      "statusLabel": "confirmed",
      "recommendedStage": "protocol",
      "difference": null
    },
    {
      "rowKey": "r090",
      "sequence": 90,
      "sourceRow": 91,
      "portfolioId": "dc_charge_lv",
      "groupLabel": "DC 8PIN low-voltage signal",
      "partNumber": "1-2438787-1",
      "partName": "DC low-voltage 8pin insert",
      "supplier": "TE",
      "targetProtocolPrice": null,
      "replyPrice": null,
      "supplierReply": "",
      "statusKey": "no_reply",
      "statusLabel": "no_reply",
      "recommendedStage": "sample",
      "difference": null
    },
    {
      "rowKey": "r093",
      "sequence": 93,
      "sourceRow": 94,
      "portfolioId": "ac_charge_lv",
      "groupLabel": "AC 6PIN low-voltage signal",
      "partNumber": "1-2355517-5",
      "partName": "AC low-voltage 5pin insert",
      "supplier": "TE",
      "targetProtocolPrice": null,
      "replyPrice": null,
      "supplierReply": "",
      "statusKey": "no_reply",
      "statusLabel": "no_reply",
      "recommendedStage": "sample",
      "difference": null
    },
    {
      "rowKey": "r097",
      "sequence": 97,
      "sourceRow": 98,
      "portfolioId": "electronic_lock",
      "groupLabel": "Electronic lock low-voltage connector",
      "partNumber": "5-965906-5",
      "partName": "Electronic lock 4pin insert",
      "supplier": "TE",
      "targetProtocolPrice": null,
      "replyPrice": null,
      "supplierReply": "",
      "statusKey": "no_reply",
      "statusLabel": "no_reply",
      "recommendedStage": "sample",
      "difference": null
    },
    {
      "rowKey": "r100",
      "sequence": 100,
      "sourceRow": 101,
      "portfolioId": "low_voltage_inline",
      "groupLabel": "Low-voltage inline connector",
      "partNumber": "5-2385463-1",
      "partName": "Plastic shell",
      "supplier": "TE",
      "targetProtocolPrice": null,
      "replyPrice": null,
      "supplierReply": "",
      "statusKey": "no_reply",
      "statusLabel": "no_reply",
      "recommendedStage": "sample",
      "difference": null
    },
    {
      "rowKey": "r108",
      "sequence": 108,
      "sourceRow": 109,
      "portfolioId": "charge_socket_main",
      "groupLabel": "Fast charge / DC / 180deg",
      "partNumber": "HVSPC2P1900FS1-M",
      "partName": "Straight cover Code A0 180deg",
      "supplier": "Amphenol",
      "targetProtocolPrice": 31.0,
      "replyPrice": null,
      "supplierReply": "OK",
      "statusKey": "confirmed",
      "statusLabel": "confirmed",
      "recommendedStage": "protocol",
      "difference": null
    },
    {
      "rowKey": "r114",
      "sequence": 114,
      "sourceRow": 115,
      "portfolioId": "charge_socket_main",
      "groupLabel": "Slow charge / AC",
      "partNumber": "HVC2PG263FSW1-M-NH-P010",
      "partName": "Plug assembly Code A",
      "supplier": "Amphenol",
      "targetProtocolPrice": 9.0,
      "replyPrice": null,
      "supplierReply": "OK",
      "statusKey": "confirmed",
      "statusLabel": "confirmed",
      "recommendedStage": "protocol",
      "difference": null
    },
    {
      "rowKey": "r119",
      "sequence": 119,
      "sourceRow": 120,
      "portfolioId": "charge_socket_main",
      "groupLabel": "Fast charge / DC / 90deg",
      "partNumber": "HVSPC2P1900FV1-M",
      "partName": "Straight cover Code A0 90deg",
      "supplier": "Amphenol",
      "targetProtocolPrice": 31.0,
      "replyPrice": null,
      "supplierReply": "OK",
      "statusKey": "confirmed",
      "statusLabel": "confirmed",
      "recommendedStage": "protocol",
      "difference": null
    },
    {
      "rowKey": "r125",
      "sequence": 125,
      "sourceRow": 126,
      "portfolioId": "ptc_end",
      "groupLabel": "PTC end / Yonggui",
      "partNumber": "115490007801",
      "partName": "Chain welded terminal",
      "supplier": "Yonggui",
      "targetProtocolPrice": 50.0,
      "replyPrice": null,
      "supplierReply": "OK",
      "statusKey": "confirmed",
      "statusLabel": "confirmed",
      "recommendedStage": "protocol",
      "difference": null
    },
    {
      "rowKey": "r129",
      "sequence": 129,
      "sourceRow": 130,
      "portfolioId": "battery_end_hv",
      "groupLabel": "Battery end / 4mm / 135deg",
      "partNumber": "113990002546",
      "partName": "YGC1612-EV-P2PWNA1 plug assembly",
      "supplier": "Yonggui",
      "targetProtocolPrice": 17.0,
      "replyPrice": null,
      "supplierReply": "in development",
      "statusKey": "dev_pending",
      "statusLabel": "dev_pending",
      "recommendedStage": "sample",
      "difference": null
    }
  ]
}

};
