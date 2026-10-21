import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, X, Sparkles, ArrowUpRight } from "lucide-react";
import { people, statusMap } from "./theme";

export const spring = { type: "spring", stiffness: 380, damping: 30 };
export function IconButton({ icon: Icon, label, className = "", ...props }) {
  return (
    <button
      type="button"
      className={`icon-btn ${className}`}
      aria-label={label}
      title={label}
      {...props}
    >
      <Icon size={18} strokeWidth={1.65} />
    </button>
  );
}
export function Button({ children, icon: Icon, className = "", ...props }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.97 }}
      transition={spring}
      className={`btn ${className}`}
      {...props}
    >
      {Icon && <Icon size={16} strokeWidth={1.8} />}
      {children}
    </motion.button>
  );
}
export function Glass({
  as: Tag = "section",
  className = "",
  children,
  ...props
}) {
  const ref = useRef(null);
  function move(e) {
    const r = ref.current.getBoundingClientRect();
    ref.current.style.setProperty("--mx", `${e.clientX - r.left}px`);
    ref.current.style.setProperty("--my", `${e.clientY - r.top}px`);
  }
  return (
    <Tag
      ref={ref}
      onPointerMove={move}
      className={`glass border border-white/90 bg-white/75 backdrop-blur-2xl backdrop-saturate-[180%] ${className}`}
      {...props}
    >
      {children}
    </Tag>
  );
}
export function Avatars({ members = [0, 1, 2], small = false }) {
  return (
    <span
      className={`avatars ${small ? "small" : ""}`}
      aria-label={`示例协作者：${members.map((i) => people[i].name).join("、")}`}
    >
      {members.map((i) => (
        <span
          className={`avatar ${people[i].color}`}
          key={i}
          title={`${people[i].name}同学`}
        >
          {people[i].name}
        </span>
      ))}
    </span>
  );
}
export function Status({ status }) {
  const [label, color] = statusMap[status] || statusMap.queued;
  return (
    <span className={`status ${color}`}>
      <i />
      {label}
    </span>
  );
}
export function Empty({
  title = "暂无记录",
  text,
  action,
}) {
  return (
    <div className="empty">
      <span className="empty-glyph">
        <Sparkles size={25} strokeWidth={1.3} />
      </span>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}
export function Dialog({
  title,
  children,
  onClose,
  wide = false,
  drawer = false,
}) {
  const ref = useRef(null);
  const previous = useRef(document.activeElement);
  useEffect(() => {
    const root = document.getElementById("root");
    root.inert = true;
    const focusable = () =>
      [
        ...ref.current.querySelectorAll(
          'button, input, select, textarea, a[href], [tabindex="0"]',
        ),
      ].filter((el) => !el.disabled && el.getClientRects().length);
    const first =
      ref.current.querySelector("[data-autofocus]") || focusable()[0];
    first?.focus();
    const key = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if (e.key === "Tab") {
        const items = focusable();
        const f = items[0],
          l = items[items.length - 1];
        if (!items.length) {
          e.preventDefault();
          return;
        }
        if (e.shiftKey && document.activeElement === f) {
          e.preventDefault();
          l.focus();
        } else if (!e.shiftKey && document.activeElement === l) {
          e.preventDefault();
          f.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      root.inert = false;
      document.removeEventListener("keydown", key);
      previous.current?.focus?.();
    };
  }, [onClose]);
  return createPortal(
    <motion.div
      className={`modal-layer ${drawer ? "drawer-layer" : ""}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.section
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`dialog glass ${wide ? "wide" : ""} ${drawer ? "drawer" : ""}`}
        initial={
          drawer ? { x: 70, opacity: 0 } : { y: 20, scale: 0.97, opacity: 0 }
        }
        animate={{ x: 0, y: 0, scale: 1, opacity: 1 }}
        transition={spring}
      >
        <header className="dialog-head">
          <div>
            <h2>{title}</h2>
          </div>
          <IconButton icon={X} label="关闭弹窗" onClick={onClose} />
        </header>
        {children}
      </motion.section>
    </motion.div>,
    document.body,
  );
}
export function Toasts({ items, dismiss }) {
  return createPortal(
    <div className="toasts" role="status" aria-live="polite">
      <AnimatePresence>
        {items.map((t) => (
          <motion.div
            key={t.id}
            className={`toast glass ${t.error ? "error" : ""}`}
            initial={{ y: 18, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 8, opacity: 0 }}
            transition={spring}
          >
            <span className="toast-icon">
              <Check size={16} />
            </span>
            <span>{t.text}</span>
            <IconButton
              icon={X}
              label="关闭通知"
              onClick={() => dismiss(t.id)}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
export function SectionHeading({ title, count, subtitle, action }) {
  return (
    <div className="section-heading">
      <div>
        <h2>
          {title}
          {count !== undefined && <span className="count">{count}</span>}
        </h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
export function TextLink({ children, onClick }) {
  return (
    <button className="text-link" onClick={onClick}>
      {children}
      <ArrowUpRight size={14} />
    </button>
  );
}
export function Sparkline({
  points = [18, 20, 16, 24, 23, 29, 27, 36],
  color = "#6589dc",
}) {
  const d = points
    .map(
      (p, i) => `${i ? "L" : "M"} ${i * (100 / (points.length - 1))} ${45 - p}`,
    )
    .join(" ");
  return (
    <svg
      className="sparkline"
      viewBox="0 0 104 48"
      aria-label="最近七天采集数量趋势"
      role="img"
    >
      <path d={`${d} L100 48 L0 48Z`} fill={color} opacity="0.065" />
      <path
        d={d}
        stroke={color}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SegmentedTabs({items, value, onChange, label, id}) {
  const ref = useRef(null);
  function keyboard(event) {
    const current = items.findIndex(item => item.id === value);
    let next;
    if (event.key === "ArrowRight") next = (current + 1) % items.length;
    else if (event.key === "ArrowLeft") next = (current - 1 + items.length) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    else return;
    event.preventDefault();
    onChange(items[next].id);
    ref.current.querySelectorAll('[role="tab"]')[next]?.focus();
  }
  return <div ref={ref} className="segmented-tabs" role="tablist" aria-label={label} onKeyDown={keyboard}>
    {items.map(({id:key,label:text,icon:Icon}) => <button type="button" key={key} role="tab" aria-selected={value===key} tabIndex={value===key?0:-1} onClick={() => onChange(key)}>
      {value===key && <motion.span layoutId={`${id}-active`} className="segment-highlight" transition={spring} />}
      {Icon && <Icon size={15}/>}<span>{text}</span>
    </button>)}
  </div>;
}
