;(function (global) {
  if (global.G281OperatingLaborRateSeedData) {
    return;
  }

  const factories = [
    'K1/K2工厂',
    'K3工厂',
    '宁波工厂',
    '仪征工厂',
    '重庆工厂低压',
    '重庆工厂高压',
    '天津工厂',
  ];

  function makeValues(base, step, skew = 0) {
    const pivot = Math.floor(factories.length / 2);
    return factories.reduce((acc, factory, index) => {
      const delta = (index - pivot) * step + skew;
      acc[factory] = Number((base + delta).toFixed(1));
      return acc;
    }, {});
  }

  const efficiencyGroups = [
    {
      groupLabel: '直接人工效率',
      rows: [
        { label: '前工程开线效率', unit: '%', values: makeValues(91.5, 0.5) },
        { label: '前工程公共制程效率', unit: '%', values: makeValues(88.3, 0.35, -1.0) },
        { label: '后工程总装效率', unit: '%', values: makeValues(85.2, 0.4, -0.5) },
        { label: '间接人工出勤效率', unit: '%', values: makeValues(78.6, 0.3, -1.2) },
      ],
    },
    {
      groupLabel: '制造费用效率',
      rows: [
        { label: '低值易耗品损耗率', unit: '%', values: makeValues(4.5, 0.05, 0.2) },
        { label: '机构料损耗率', unit: '%', values: makeValues(5.2, 0.08, 0.1) },
        { label: '厂房分摊占比', unit: '%', values: makeValues(3.4, 0.06, 0.3) },
        { label: '自动化仓/仓储分摊', unit: '%', values: makeValues(2.1, 0.04, 0.5) },
        { label: '其他制造费用', unit: '%', values: makeValues(1.9, 0.03, 0.1) },
        { label: '材料损耗率', unit: '%', values: makeValues(6.8, 0.1, -0.4) },
      ],
    },
  ];

  const laborRateGroups = [
    {
      groupLabel: '直接人工工时费率',
      rows: [
        { label: '前工程开线费率', unit: '元/工时', values: makeValues(58.2, 0.8, 1.5) },
        { label: '前工程公共制程费率', unit: '元/工时', values: makeValues(55.5, 0.6, 1.1) },
        { label: '后工程总装费率', unit: '元/工时', values: makeValues(62.3, 1.0, 0.2) },
        { label: '间接人工费率', unit: '元/工时', values: makeValues(49.8, 0.4, -0.9) },
      ],
    },
    {
      groupLabel: '制造费用工时费率',
      rows: [
        { label: '低值易耗品费率', unit: '元/工时', values: makeValues(8.5, 0.2, 0.6) },
        { label: '机构料损耗费率', unit: '元/工时', values: makeValues(11.3, 0.3, 0.9) },
        { label: '厂房分摊费率', unit: '元/工时', values: makeValues(13.4, 0.25, 1.2) },
        { label: '自动化仓/仓储费率', unit: '元/工时', values: makeValues(7.1, 0.15, 0.4) },
        { label: '其他制造费用费率', unit: '元/工时', values: makeValues(6.6, 0.2, 0.3) },
        { label: '材料损耗费率', unit: '元/工时', values: makeValues(19.7, 0.4, 0.5) },
      ],
    },
  ];

  global.G281OperatingLaborRateSeedData = {
    factories,
    efficiency: {
      groups: efficiencyGroups,
      note: '效率数据用于评估各工厂直接人工与制造费用的折算口径，可按项目评估阶段手工修订。',
    },
    laborRate: {
      groups: laborRateGroups,
      note: '运营工时费率用于报价、定点、TT 等版本的人工与制造费用测算，当前为离线本地维护数据。',
    },
  };
})(window);
