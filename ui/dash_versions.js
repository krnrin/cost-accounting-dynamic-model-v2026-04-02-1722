function renderVersionGroupChips(group, options, box) {
  box.innerHTML = '';
  orderedVersionEntries(group, options).forEach(([key, option]) => {
    const chip = document.createElement('div');
    chip.className = 'option-chip' + (option?.userCreated ? ' is-user-created' : '');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'option' + (state[group] === key ? ' active' : '');
    button.textContent = option.label;
    button.title = option.note;
    button.addEventListener('click', () => {
      state[group] = key;
      if (group === 'connector') {
        connectorPricingState = sanitizeConnectorPricing(connectorPricingState, state.connector);
      }
      applyVersionPreset(group, key);
      renderVersions();
      queueRender();
    });
    chip.appendChild(button);
    if (option?.userCreated) {
      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'option-delete-btn';
      deleteButton.title = `删除版本 ${option.label}`;
      deleteButton.setAttribute('aria-label', `删除版本 ${option.label}`);
      deleteButton.textContent = '×';
      deleteButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        deleteUserVersion(group, key);
      });
      chip.appendChild(deleteButton);
    }
    box.appendChild(chip);
  });
}

function renderVersionGroupNote(group, options, note, currentOption) {
  if (group === 'connector') {
    const connectorSourceKey = BASE.versions?.connector?.[state.connector]?.sourceKey || state.connector;
    const overrideCount = connectorOverrideCount(connectorPricingState, connectorSourceKey);
    note.textContent = `默认执行版本：${currentOption.label}。${currentOption.note} 当前已单独指定 ${overrideCount} 个连接器。`;
    return;
  }
  if (group === 'sales') {
    const salesStats = salesVersionStats(state.sales);
    note.textContent = `${currentOption.note} 生命周期 ${fmtInt(salesStats.total)} 套，首年 ${fmtInt(salesStats.firstYear)} 套。`;
    return;
  }
  if (group === 'metal') {
    renderMetalVersionEditor();
    const lockText = metalVersionLocks[state[group]] !== false ? '当前版本已锁定。' : '当前版本编辑中。';
    note.textContent = `${currentOption.note} ${metalVersionSourceText(state[group])} ${lockText}`.trim();
    return;
  }
  if (group === 'mix') {
    note.textContent = `${currentOption.note} ${mixVersionSummary(state.mix)}。`;
    return;
  }
  if (group === 'bom') {
    note.textContent = `${currentOption.note} ${bomVersionSourceText(state[group])}`.trim();
    return;
  }
  if (group === 'labor') {
    note.textContent = `${currentOption.note} ${laborVersionSourceText(state[group])}`.trim();
    return;
  }
  if (group === 'equipment') {
    note.textContent = `${currentOption.note} ${equipmentVersionSourceText(state[group])}`.trim();
    return;
  }
  if (group === 'packaging') {
    note.textContent = `${currentOption.note} ${packagingVersionSourceText(state[group])}`.trim();
    return;
  }
  if (group === 'configSheet') {
    note.textContent = `${currentOption.note} ${configSheetVersionSourceText(state[group])}`.trim();
    return;
  }
  if (group === 'annualDrop') {
    note.textContent = `${currentOption.note} ${annualDropVersionSourceText(state[group])}`.trim();
    return;
  }
  if (group === 'oneTimeCustomer') {
    note.textContent = `${currentOption.note} ${oneTimeCustomerVersionSourceText(state[group])}`.trim();
    return;
  }
  if (group === 'rebate') {
    note.textContent = `${currentOption.note} ${rebateVersionSourceText(state[group])}`.trim();
    return;
  }
  note.textContent = currentOption.note;
}
