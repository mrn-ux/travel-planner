/* @ds-bundle: {"format":4,"namespace":"FaroDesignSystem_c83241","components":[{"name":"ChatMessage","sourcePath":"components/chat/ChatMessage.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"EmptyState","sourcePath":"components/core/EmptyState.jsx"},{"name":"Input","sourcePath":"components/core/Input.jsx"},{"name":"KPICard","sourcePath":"components/core/KPICard.jsx"},{"name":"Modal","sourcePath":"components/core/Modal.jsx"},{"name":"NavItem","sourcePath":"components/core/NavItem.jsx"},{"name":"Select","sourcePath":"components/core/Select.jsx"},{"name":"StatusBadge","sourcePath":"components/core/StatusBadge.jsx"},{"name":"BookingStepper","sourcePath":"components/travel/BookingStepper.jsx"},{"name":"BudgetBreakdown","sourcePath":"components/travel/BudgetBreakdown.jsx"},{"name":"ComparisonTable","sourcePath":"components/travel/ComparisonTable.jsx"},{"name":"DayItineraryCard","sourcePath":"components/travel/DayItineraryCard.jsx"},{"name":"DestinationCard","sourcePath":"components/travel/DestinationCard.jsx"}],"sourceHashes":{"components/chat/ChatMessage.jsx":"4e8f0a8e0eb7","components/core/Button.jsx":"60ecc18c5ace","components/core/Card.jsx":"01f095ea3a99","components/core/EmptyState.jsx":"81a0ab9f686e","components/core/Input.jsx":"7c4c8e996099","components/core/KPICard.jsx":"20f302c38cc0","components/core/Modal.jsx":"4d7877790a7b","components/core/NavItem.jsx":"9b9db23f007c","components/core/Select.jsx":"633a5d5ab5b7","components/core/StatusBadge.jsx":"549cd02c343f","components/travel/BookingStepper.jsx":"62fb960c1124","components/travel/BudgetBreakdown.jsx":"bb3764347672","components/travel/ComparisonTable.jsx":"40470975b733","components/travel/DayItineraryCard.jsx":"36a3275566d1","components/travel/DestinationCard.jsx":"c1d0341061f9","ui_kits/app/App.jsx":"b8cae1873057","ui_kits/app/HomeScreen.jsx":"2fb4fdcca806","ui_kits/app/HotelsScreen.jsx":"d7c9488cfbaa","ui_kits/app/ItineraryScreen.jsx":"6fa411777411","ui_kits/app/MyTripsScreen.jsx":"aac1d3fd5653","ui_kits/app/Nav.jsx":"8b5822173ef3","ui_kits/app/PlannerScreen.jsx":"0f02fe1fd284"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.FaroDesignSystem_c83241 = window.FaroDesignSystem_c83241 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/chat/ChatMessage.jsx
try { (() => {
function ChatMessage({
  role = 'agent',
  text,
  followUps,
  results
}) {
  const isAgent = role === 'agent';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: isAgent ? 'flex-start' : 'flex-end',
      gap: 8,
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: '70%',
      background: isAgent ? 'var(--surface-muted)' : 'var(--accent-soft)',
      borderRadius: 'var(--radius-md)',
      padding: '10px 14px',
      fontSize: 'var(--text-sm-size)',
      lineHeight: 'var(--text-sm-lh)',
      color: 'var(--text)'
    }
  }, text, followUps && followUps.length > 0 && /*#__PURE__*/React.createElement("ul", {
    style: {
      margin: '8px 0 0',
      paddingLeft: 18
    }
  }, followUps.map((q, i) => /*#__PURE__*/React.createElement("li", {
    key: i,
    style: {
      marginTop: 4
    }
  }, q)))), results && /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: '85%',
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, results));
}
Object.assign(__ds_scope, { ChatMessage });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/chat/ChatMessage.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
const base = {
  height: 40,
  padding: '0 16px',
  borderRadius: 'var(--radius-md)',
  fontFamily: 'var(--font-sans)',
  fontSize: 'var(--text-sm-size)',
  lineHeight: 'var(--text-sm-lh)',
  fontWeight: 'var(--weight-label)',
  border: '1px solid transparent',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8
};
const variants = {
  primary: {
    background: 'var(--accent)',
    color: '#fff'
  },
  secondary: {
    background: 'var(--surface)',
    color: 'var(--text)',
    borderColor: 'var(--border)'
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text-secondary)'
  },
  danger: {
    background: 'var(--danger)',
    color: '#fff'
  }
};
const hoverBg = {
  primary: 'var(--accent-hover)',
  ghost: 'var(--surface-muted)'
};
function Button({
  variant = 'primary',
  disabled = false,
  children,
  onClick,
  type = 'button'
}) {
  const [hover, setHover] = React.useState(false);
  const style = {
    ...base,
    ...variants[variant],
    opacity: disabled ? 0.4 : 1,
    pointerEvents: disabled ? 'none' : 'auto',
    ...(hover && hoverBg[variant] ? {
      background: hoverBg[variant]
    } : {})
  };
  return /*#__PURE__*/React.createElement("button", {
    type: type,
    style: style,
    disabled: disabled,
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false)
  }, children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function Card({
  title,
  children,
  padding = 24
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      boxShadow: 'var(--shadow-raised)',
      padding,
      fontFamily: 'var(--font-sans)'
    }
  }, title && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 'var(--text-lg-size)',
      lineHeight: 'var(--text-lg-lh)',
      fontWeight: 600,
      color: 'var(--text)',
      marginBottom: 12
    }
  }, title), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/EmptyState.jsx
try { (() => {
function EmptyState({
  message,
  actionLabel,
  onAction
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 16,
      padding: '48px 0',
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-sm-size)',
      color: 'var(--text-muted)'
    }
  }, message), actionLabel && /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    onClick: onAction
  }, actionLabel));
}
function Button({
  variant,
  onClick,
  children
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    style: {
      height: 40,
      padding: '0 16px',
      borderRadius: 'var(--radius-md)',
      background: 'var(--accent)',
      color: '#fff',
      border: 'none',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-sm-size)',
      fontWeight: 'var(--weight-label)',
      cursor: 'pointer'
    }
  }, children);
}
Object.assign(__ds_scope, { EmptyState });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/EmptyState.jsx", error: String((e && e.message) || e) }); }

// components/core/Input.jsx
try { (() => {
function Input({
  label,
  placeholder,
  value,
  onChange,
  error,
  type = 'text'
}) {
  const [focused, setFocused] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      fontFamily: 'var(--font-sans)'
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 'var(--text-sm-size)',
      fontWeight: 'var(--weight-label)',
      color: 'var(--text-secondary)'
    }
  }, label), /*#__PURE__*/React.createElement("input", {
    type: type,
    value: value,
    onChange: onChange,
    placeholder: placeholder,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    style: {
      height: 40,
      padding: '0 12px',
      background: 'var(--surface)',
      border: `1px solid ${error ? 'var(--danger)' : focused ? 'var(--border-strong)' : 'var(--border)'}`,
      borderRadius: 'var(--radius-sm)',
      fontSize: 'var(--text-base-size)',
      color: 'var(--text)',
      outline: focused ? '2px solid var(--focus-ring)' : 'none',
      outlineOffset: 2
    }
  }), error && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-xs-size)',
      color: 'var(--danger)'
    }
  }, error));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Input.jsx", error: String((e && e.message) || e) }); }

// components/core/KPICard.jsx
try { (() => {
function KPICard({
  label,
  value,
  valueColor
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      boxShadow: 'var(--shadow-raised)',
      padding: 24,
      fontFamily: 'var(--font-sans)',
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-sm-size)',
      color: 'var(--text-secondary)'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    className: "tabular",
    style: {
      fontSize: 'var(--text-xl-size)',
      lineHeight: 'var(--text-xl-lh)',
      fontWeight: 600,
      color: valueColor || 'var(--text)'
    }
  }, value));
}
Object.assign(__ds_scope, { KPICard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/KPICard.jsx", error: String((e && e.message) || e) }); }

// components/core/Modal.jsx
try { (() => {
function Modal({
  title,
  children,
  actions,
  onClose
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      inset: 0,
      background: 'var(--modal-backdrop)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100
    },
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      background: 'var(--surface)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-modal)',
      padding: 32,
      maxWidth: 480,
      width: '100%',
      fontFamily: 'var(--font-sans)'
    }
  }, title && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 'var(--text-lg-size)',
      fontWeight: 600,
      color: 'var(--text)',
      marginBottom: 16
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--text)',
      fontSize: 'var(--text-sm-size)'
    }
  }, children), actions && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: 12,
      marginTop: 24
    }
  }, actions)));
}
Object.assign(__ds_scope, { Modal });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Modal.jsx", error: String((e && e.message) || e) }); }

// components/core/NavItem.jsx
try { (() => {
function NavItem({
  children,
  active = false,
  onClick
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("a", {
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '8px 12px',
      borderRadius: 'var(--radius-sm)',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-sm-size)',
      fontWeight: 'var(--weight-label)',
      cursor: 'pointer',
      textDecoration: 'none',
      color: active ? 'var(--accent)' : hover ? 'var(--text)' : 'var(--text-secondary)',
      background: active ? 'var(--accent-soft)' : 'transparent'
    }
  }, children);
}
Object.assign(__ds_scope, { NavItem });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/NavItem.jsx", error: String((e && e.message) || e) }); }

// components/core/Select.jsx
try { (() => {
function Select({
  label,
  value,
  onChange,
  options = []
}) {
  const [focused, setFocused] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      fontFamily: 'var(--font-sans)'
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 'var(--text-sm-size)',
      fontWeight: 'var(--weight-label)',
      color: 'var(--text-secondary)'
    }
  }, label), /*#__PURE__*/React.createElement("select", {
    value: value,
    onChange: onChange,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    style: {
      height: 40,
      padding: '0 12px',
      background: 'var(--surface)',
      color: 'var(--text)',
      border: `1px solid ${focused ? 'var(--border-strong)' : 'var(--border)'}`,
      borderRadius: 'var(--radius-sm)',
      fontSize: 'var(--text-base-size)',
      outline: focused ? '2px solid var(--focus-ring)' : 'none',
      outlineOffset: 2
    }
  }, options.map(o => /*#__PURE__*/React.createElement("option", {
    key: o,
    value: o
  }, o))));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Select.jsx", error: String((e && e.message) || e) }); }

// components/core/StatusBadge.jsx
try { (() => {
const config = {
  confirmed: {
    color: 'var(--confirmed)',
    bg: 'rgba(31,122,77,0.1)',
    glyph: '✓',
    label: 'Confirmed'
  },
  estimated: {
    color: 'var(--estimated)',
    bg: 'rgba(184,117,46,0.1)',
    glyph: '~',
    label: 'Estimated'
  },
  unavailable: {
    color: 'var(--text-muted)',
    bg: 'var(--surface-muted)',
    glyph: '–',
    label: 'Unavailable'
  }
};
function StatusBadge({
  status = 'confirmed'
}) {
  const c = config[status];
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '2px 8px',
      borderRadius: 'var(--radius-sm)',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-xs-size)',
      fontWeight: 'var(--weight-label)',
      color: c.color,
      background: c.bg
    }
  }, /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true"
  }, c.glyph), c.label);
}
Object.assign(__ds_scope, { StatusBadge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/StatusBadge.jsx", error: String((e && e.message) || e) }); }

// components/travel/BookingStepper.jsx
try { (() => {
const steps = ['Select room', 'Verify availability', 'Price & terms', 'Guest details', 'Confirm', 'Pay', 'Confirmation'];
function BookingStepper({
  currentStep = 0
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      fontFamily: 'var(--font-sans)'
    }
  }, steps.map((s, i) => {
    const done = i < currentStep,
      current = i === currentStep;
    return /*#__PURE__*/React.createElement(React.Fragment, {
      key: s
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 20,
        height: 20,
        borderRadius: 'var(--radius-full)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        background: done ? 'var(--accent-soft)' : 'transparent',
        color: done ? 'var(--accent)' : current ? 'var(--accent)' : 'var(--text-muted)',
        border: current ? '2px solid var(--accent)' : done ? 'none' : '1px solid var(--border)'
      }
    }, done ? '✓' : current ? '●' : ''), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 'var(--text-xs-size)',
        textAlign: 'center',
        color: current ? 'var(--accent)' : done ? 'var(--text)' : 'var(--text-muted)',
        fontWeight: current ? 600 : 400
      }
    }, s)), i < steps.length - 1 && /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        height: 1,
        background: 'var(--border)',
        margin: '0 4px 20px'
      }
    }));
  }));
}
Object.assign(__ds_scope, { BookingStepper });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/travel/BookingStepper.jsx", error: String((e && e.message) || e) }); }

// components/travel/BudgetBreakdown.jsx
try { (() => {
const palette = ['var(--chart-hotels)', 'var(--chart-transportation)', 'var(--chart-activities)', 'var(--chart-food)', 'var(--chart-local-transport)', 'var(--chart-misc)'];
function BudgetBreakdown({
  categories = [],
  total,
  budget,
  remaining
}) {
  const sum = categories.reduce((s, c) => s + c.amount, 0);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      height: 12,
      borderRadius: 'var(--radius-full)',
      overflow: 'hidden'
    }
  }, categories.map((c, i) => /*#__PURE__*/React.createElement("div", {
    key: c.label,
    style: {
      width: `${c.amount / sum * 100}%`,
      background: palette[i % palette.length]
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 16
    }
  }, categories.map((c, i) => /*#__PURE__*/React.createElement("div", {
    key: c.label,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 'var(--text-sm-size)',
      color: 'var(--text-secondary)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: 'var(--radius-full)',
      background: palette[i % palette.length]
    }
  }), c.label, " ", /*#__PURE__*/React.createElement("span", {
    className: "tabular",
    style: {
      color: 'var(--text)'
    }
  }, c.amount)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 32,
      paddingTop: 16,
      borderTop: '1px solid var(--border)'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-sm-size)',
      color: 'var(--text-secondary)'
    }
  }, "Estimated total"), /*#__PURE__*/React.createElement("div", {
    className: "tabular",
    style: {
      fontSize: 'var(--text-xl-size)',
      fontWeight: 600,
      color: 'var(--text)'
    }
  }, total)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-sm-size)',
      color: 'var(--text-secondary)'
    }
  }, "Budget"), /*#__PURE__*/React.createElement("div", {
    className: "tabular",
    style: {
      fontSize: 'var(--text-xl-size)',
      fontWeight: 600,
      color: 'var(--text)'
    }
  }, budget)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-sm-size)',
      color: 'var(--text-secondary)'
    }
  }, "Remaining"), /*#__PURE__*/React.createElement("div", {
    className: "tabular",
    style: {
      fontSize: 'var(--text-xl-size)',
      fontWeight: 600,
      color: remaining && remaining.trim().startsWith('-') ? 'var(--over-budget)' : 'var(--under-budget)'
    }
  }, remaining))));
}
Object.assign(__ds_scope, { BudgetBreakdown });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/travel/BudgetBreakdown.jsx", error: String((e && e.message) || e) }); }

// components/travel/ComparisonTable.jsx
try { (() => {
function ComparisonTable({
  columns = [],
  rows = [],
  sortKey,
  onSort
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse'
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      background: 'var(--surface-muted)'
    }
  }, columns.map(c => /*#__PURE__*/React.createElement("th", {
    key: c.key,
    onClick: () => c.sortable && onSort && onSort(c.key),
    style: {
      textAlign: c.align || 'left',
      padding: '12px 16px',
      fontSize: 'var(--text-xs-size)',
      fontWeight: 'var(--weight-label)',
      color: 'var(--text-secondary)',
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      cursor: c.sortable ? 'pointer' : 'default'
    }
  }, c.label, c.sortable && sortKey === c.key ? ' ↓' : '')))), /*#__PURE__*/React.createElement("tbody", null, rows.map((row, i) => /*#__PURE__*/React.createElement("tr", {
    key: i,
    style: {
      borderTop: '1px solid var(--border)'
    },
    onMouseEnter: e => e.currentTarget.style.background = 'var(--surface-muted)',
    onMouseLeave: e => e.currentTarget.style.background = 'transparent'
  }, columns.map(c => /*#__PURE__*/React.createElement("td", {
    key: c.key,
    className: c.tabular ? 'tabular' : '',
    style: {
      textAlign: c.align || 'left',
      padding: '12px 16px',
      fontSize: 'var(--text-sm-size)',
      color: 'var(--text)'
    }
  }, row[c.key])))))));
}
Object.assign(__ds_scope, { ComparisonTable });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/travel/ComparisonTable.jsx", error: String((e && e.message) || e) }); }

// components/travel/DayItineraryCard.jsx
try { (() => {
function Segment({
  label,
  items
}) {
  if (!items || items.length === 0) return null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-sm-size)',
      fontWeight: 'var(--weight-label)',
      color: 'var(--text-secondary)'
    }
  }, label), items.map((item, i) => /*#__PURE__*/React.createElement("div", {
    key: i
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-sm-size)',
      color: 'var(--text)'
    }
  }, item.title), /*#__PURE__*/React.createElement("div", {
    className: "tabular",
    style: {
      fontSize: 'var(--text-sm-size)',
      color: 'var(--text-secondary)',
      whiteSpace: 'nowrap'
    }
  }, item.duration, " \xB7 ", item.cost)), item.hours && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-xs-size)',
      color: 'var(--text-muted)',
      marginTop: 2
    }
  }, item.hours), item.travelTime && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-xs-size)',
      color: 'var(--text-muted)',
      marginTop: 6,
      paddingLeft: 8,
      borderLeft: '1px solid var(--border)'
    }
  }, item.travelTime, " to next stop"))));
}
function DayItineraryCard({
  day,
  date,
  morning,
  afternoon,
  evening
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      boxShadow: 'var(--shadow-raised)',
      padding: 24,
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 'var(--text-lg-size)',
      fontWeight: 600,
      color: 'var(--text)'
    }
  }, "Day ", day, " ", date && `· ${date}`), /*#__PURE__*/React.createElement(Segment, {
    label: "Morning",
    items: morning
  }), /*#__PURE__*/React.createElement(Segment, {
    label: "Afternoon",
    items: afternoon
  }), /*#__PURE__*/React.createElement(Segment, {
    label: "Evening",
    items: evening
  }));
}
Object.assign(__ds_scope, { DayItineraryCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/travel/DayItineraryCard.jsx", error: String((e && e.message) || e) }); }

// components/travel/DestinationCard.jsx
try { (() => {
function DestinationCard({
  rank,
  name,
  reasons = [],
  score
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      boxShadow: 'var(--shadow-raised)',
      padding: 24,
      display: 'flex',
      gap: 16,
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 'var(--text-xl-size)',
      fontWeight: 600,
      color: 'var(--text-secondary)'
    }
  }, rank), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 'var(--text-lg-size)',
      fontWeight: 600,
      color: 'var(--text)'
    }
  }, name), /*#__PURE__*/React.createElement("ul", {
    style: {
      margin: 0,
      paddingLeft: 16,
      fontSize: 'var(--text-sm-size)',
      color: 'var(--text-secondary)'
    }
  }, reasons.map((r, i) => /*#__PURE__*/React.createElement("li", {
    key: i
  }, r))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 6,
      background: 'var(--surface-muted)',
      borderRadius: 'var(--radius-full)',
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: `${score}%`,
      height: '100%',
      background: 'var(--accent)',
      borderRadius: 'var(--radius-full)'
    }
  }))));
}
Object.assign(__ds_scope, { DestinationCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/travel/DestinationCard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/App.jsx
try { (() => {
function App() {
  const [screen, setScreen] = React.useState('home');
  const [destination, setDestination] = React.useState('Lisbon, Portugal');
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: '100vh',
      background: 'var(--bg)'
    }
  }, /*#__PURE__*/React.createElement(window.Nav, {
    screen: screen,
    setScreen: setScreen
  }), screen === 'home' && /*#__PURE__*/React.createElement(window.HomeScreen, {
    onPlan: () => setScreen('planner')
  }), screen === 'planner' && /*#__PURE__*/React.createElement(window.PlannerScreen, {
    onChooseDestination: d => {
      setDestination(d);
      setScreen('hotels');
    }
  }), screen === 'hotels' && /*#__PURE__*/React.createElement(window.HotelsScreen, {
    destination: destination,
    onBook: () => setScreen('itinerary')
  }), screen === 'itinerary' && /*#__PURE__*/React.createElement(window.ItineraryScreen, null), screen === 'trips' && /*#__PURE__*/React.createElement(window.MyTripsScreen, {
    onPlan: () => setScreen('home')
  }));
}
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(App, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/App.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/HomeScreen.jsx
try { (() => {
function HomeScreen({
  onPlan
}) {
  const {
    Button,
    Input,
    Select
  } = window.FaroDesignSystem_c83241;
  const [desc, setDesc] = React.useState('Somewhere warm in November, under $2,000, for 4 nights.');
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 560,
      margin: '96px auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 24,
      padding: '0 16px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 600,
      fontSize: 'var(--text-3xl-size)',
      lineHeight: 'var(--text-3xl-lh)',
      color: 'var(--text)',
      textAlign: 'center'
    }
  }, "Where do you want to go?"), /*#__PURE__*/React.createElement(Input, {
    label: "Describe your trip",
    value: desc,
    onChange: e => setDesc(e.target.value)
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Select, {
    label: "Currency",
    options: ['USD', 'EUR', 'GBP']
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Budget",
    placeholder: "2,000"
  })), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    onClick: onPlan
  }, "Plan my trip"));
}
window.HomeScreen = HomeScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/HomeScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/HotelsScreen.jsx
try { (() => {
function HotelsScreen({
  destination,
  onBook
}) {
  const {
    ComparisonTable,
    StatusBadge,
    Button,
    Modal,
    BookingStepper
  } = window.FaroDesignSystem_c83241;
  const [sortKey, setSortKey] = React.useState('price');
  const [picking, setPicking] = React.useState(null);
  const [step, setStep] = React.useState(0);
  const rows = [{
    name: 'Hotel Avenida',
    location: 'Baixa',
    rating: '4.6',
    price: /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'flex',
        gap: 8,
        justifyContent: 'flex-end'
      }
    }, "USD 184.00 ", /*#__PURE__*/React.createElement(StatusBadge, {
      status: "confirmed"
    })),
    hotel: 'Hotel Avenida',
    amount: 'USD 184.00'
  }, {
    name: 'Baixa House',
    location: 'Baixa',
    rating: '4.3',
    price: /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'flex',
        gap: 8,
        justifyContent: 'flex-end'
      }
    }, "USD 152.00 ", /*#__PURE__*/React.createElement(StatusBadge, {
      status: "estimated"
    })),
    hotel: 'Baixa House',
    amount: 'USD 152.00'
  }, {
    name: 'Alfama Suites',
    location: 'Alfama',
    rating: '4.8',
    price: /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'flex',
        gap: 8,
        justifyContent: 'flex-end'
      }
    }, "— ", /*#__PURE__*/React.createElement(StatusBadge, {
      status: "unavailable"
    })),
    hotel: 'Alfama Suites',
    amount: '—'
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 820,
      margin: '0 auto',
      padding: '32px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 600,
      fontSize: 'var(--text-2xl-size)',
      color: 'var(--text)'
    }
  }, "Hotels in ", destination), /*#__PURE__*/React.createElement(ComparisonTable, {
    sortKey: sortKey,
    onSort: setSortKey,
    columns: [{
      key: 'name',
      label: 'Hotel'
    }, {
      key: 'location',
      label: 'Area'
    }, {
      key: 'rating',
      label: 'Rating',
      sortable: true
    }, {
      key: 'price',
      label: 'Price / night',
      align: 'right',
      tabular: true,
      sortable: true
    }],
    rows: rows.map(r => ({
      ...r,
      price: /*#__PURE__*/React.createElement("span", {
        style: {
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          justifyContent: 'flex-end'
        }
      }, r.price, /*#__PURE__*/React.createElement(Button, {
        variant: "ghost",
        onClick: () => {
          setPicking(r);
          setStep(0);
        }
      }, "Select"))
    }))
  }), picking && /*#__PURE__*/React.createElement(Modal, {
    title: `Book ${picking.hotel}`,
    onClose: () => setPicking(null),
    actions: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      onClick: () => setPicking(null)
    }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      onClick: () => {
        if (step < 6) setStep(step + 1);else {
          setPicking(null);
          onBook();
        }
      }
    }, step < 6 ? 'Continue' : 'Done'))
  }, /*#__PURE__*/React.createElement(BookingStepper, {
    currentStep: step
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 24,
      color: 'var(--text-secondary)'
    }
  }, picking.amount, " / night \xB7 ", picking.hotel)));
}
window.HotelsScreen = HotelsScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/HotelsScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/ItineraryScreen.jsx
try { (() => {
function ItineraryScreen() {
  const {
    DayItineraryCard,
    BudgetBreakdown
  } = window.FaroDesignSystem_c83241;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 820,
      margin: '0 auto',
      padding: '32px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 600,
      fontSize: 'var(--text-2xl-size)',
      color: 'var(--text)'
    }
  }, "Lisbon, Portugal — 12–16 Nov 2026"), /*#__PURE__*/React.createElement(DayItineraryCard, {
    day: 1,
    date: "12 Nov 2026",
    morning: [{
      title: 'Belém Tower',
      duration: '1h 30m',
      cost: 'USD 6.00',
      hours: 'Open 10:00–17:30',
      travelTime: '15m'
    }],
    afternoon: [{
      title: 'Time Out Market',
      duration: '1h',
      cost: 'USD 18.00',
      travelTime: '10m'
    }],
    evening: [{
      title: 'Fado dinner, Alfama',
      duration: '2h',
      cost: 'USD 42.00'
    }]
  }), /*#__PURE__*/React.createElement(DayItineraryCard, {
    day: 2,
    date: "13 Nov 2026",
    morning: [{
      title: 'Sintra day trip',
      duration: '5h',
      cost: 'USD 34.00',
      hours: 'Trains from 07:30'
    }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      boxShadow: 'var(--shadow-raised)',
      padding: 24
    }
  }, /*#__PURE__*/React.createElement(BudgetBreakdown, {
    categories: [{
      label: 'Hotels',
      amount: 920
    }, {
      label: 'Transportation',
      amount: 410
    }, {
      label: 'Activities',
      amount: 260
    }, {
      label: 'Food',
      amount: 380
    }, {
      label: 'Local transport',
      amount: 90
    }, {
      label: 'Misc',
      amount: 100
    }],
    total: "USD 2,160.00",
    budget: "USD 2,000.00",
    remaining: "-USD 160.00"
  })));
}
window.ItineraryScreen = ItineraryScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/ItineraryScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/MyTripsScreen.jsx
try { (() => {
function MyTripsScreen({
  onPlan
}) {
  const {
    KPICard,
    Card,
    Button,
    Modal,
    EmptyState
  } = window.FaroDesignSystem_c83241;
  const [canceling, setCanceling] = React.useState(false);
  const [canceled, setCanceled] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 820,
      margin: '0 auto',
      padding: '32px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 600,
      fontSize: 'var(--text-2xl-size)',
      color: 'var(--text)'
    }
  }, "My Trips"), !canceled ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Card, {
    title: "Lisbon, Portugal",
    padding: 24
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--text-secondary)',
      fontSize: 'var(--text-sm-size)',
      marginBottom: 16
    }
  }, "4 nights \xB7 12–16 Nov 2026"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 16,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement(KPICard, {
    label: "Estimated total",
    value: "USD 2,160.00"
  }), /*#__PURE__*/React.createElement(KPICard, {
    label: "Remaining",
    value: "-USD 160.00",
    valueColor: "var(--over-budget)"
  })), /*#__PURE__*/React.createElement(Button, {
    variant: "danger",
    onClick: () => setCanceling(true)
  }, "Cancel booking")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-sm-size)',
      fontWeight: 500,
      color: 'var(--text-secondary)'
    }
  }, "Past trips"), /*#__PURE__*/React.createElement(EmptyState, {
    message: "No past trips yet."
  })) : /*#__PURE__*/React.createElement(EmptyState, {
    message: "No trips yet — plan your first one.",
    actionLabel: "Plan a trip",
    onAction: onPlan
  }), canceling && /*#__PURE__*/React.createElement(Modal, {
    title: "Cancel this trip?",
    onClose: () => setCanceling(false),
    actions: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      onClick: () => setCanceling(false)
    }, "Keep trip"), /*#__PURE__*/React.createElement(Button, {
      variant: "danger",
      onClick: () => {
        setCanceling(false);
        setCanceled(true);
      }
    }, "Cancel trip"))
  }, "This can't be undone. Your held prices will be released."));
}
window.MyTripsScreen = MyTripsScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/MyTripsScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/Nav.jsx
try { (() => {
function Nav({
  screen,
  setScreen
}) {
  const {
    NavItem
  } = window.FaroDesignSystem_c83241;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: 64,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 32px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--surface)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: () => setScreen('home'),
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 600,
      fontSize: 20,
      color: 'var(--text)',
      cursor: 'pointer'
    }
  }, "Faro"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(NavItem, {
    active: screen === 'trips',
    onClick: () => setScreen('trips')
  }, "My Trips"), /*#__PURE__*/React.createElement(NavItem, null, "Profile")));
}
window.Nav = Nav;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/Nav.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/PlannerScreen.jsx
try { (() => {
function PlannerScreen({
  onChooseDestination
}) {
  const {
    ChatMessage,
    DestinationCard,
    Button
  } = window.FaroDesignSystem_c83241;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 720,
      margin: '0 auto',
      padding: '32px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(ChatMessage, {
    role: "user",
    text: "Somewhere warm in November, under $2,000, for 4 nights."
  }), /*#__PURE__*/React.createElement(ChatMessage, {
    role: "agent",
    text: "Here are two destinations that fit:",
    followUps: ['Any neighborhood preference?', 'Flexible by a few days on dates?'],
    results: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(DestinationCard, {
      rank: 1,
      name: "Lisbon, Portugal",
      score: 92,
      reasons: ['Fits your budget with room to spare', 'Mild weather in November', 'Walkable, near the water']
    }), /*#__PURE__*/React.createElement(DestinationCard, {
      rank: 2,
      name: "Marrakech, Morocco",
      score: 81,
      reasons: ['Warmer than Lisbon in November', 'Lower average hotel rates', 'Longer flight from your origin']
    }))
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      alignSelf: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "secondary"
  }, "View alternatives"), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    onClick: () => onChooseDestination('Lisbon, Portugal')
  }, "Compare hotels in Lisbon")));
}
window.PlannerScreen = PlannerScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/PlannerScreen.jsx", error: String((e && e.message) || e) }); }

__ds_ns.ChatMessage = __ds_scope.ChatMessage;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.EmptyState = __ds_scope.EmptyState;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.KPICard = __ds_scope.KPICard;

__ds_ns.Modal = __ds_scope.Modal;

__ds_ns.NavItem = __ds_scope.NavItem;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.StatusBadge = __ds_scope.StatusBadge;

__ds_ns.BookingStepper = __ds_scope.BookingStepper;

__ds_ns.BudgetBreakdown = __ds_scope.BudgetBreakdown;

__ds_ns.ComparisonTable = __ds_scope.ComparisonTable;

__ds_ns.DayItineraryCard = __ds_scope.DayItineraryCard;

__ds_ns.DestinationCard = __ds_scope.DestinationCard;

})();
