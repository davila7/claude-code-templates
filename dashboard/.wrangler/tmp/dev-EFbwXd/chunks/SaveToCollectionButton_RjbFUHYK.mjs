globalThis.process ??= {}; globalThis.process.env ??= {};
import { j as jsxRuntimeExports, C as COLLECTIONS_CHANGED_EVENT, t as track, c as componentRef, o as openSignIn, s as saveComponent, w as whenSavesSettled, m as myComponentsUrl } from './SearchModal_DgLldkrh.mjs';
import { a as reactExports } from './_@astro-renderers_BvXjVE0w.mjs';
import { c as collectionsApi } from './collections-api_CEICj9s3.mjs';

function ShieldCheckIcon({ className = "" }) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("svg", { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": "true", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M9 12l2 2 4-4" })
  ] });
}
function SkillSpectorBadge({ result, size = "sm", href }) {
  if (!result) return null;
  const md = size === "md";
  const className = `inline-flex items-center gap-1.5 font-mono font-semibold border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] ${// md sits beside the component icon: on a phone the label may not fit on one line, so it wraps instead of being clipped
  md ? "max-w-full text-xs leading-snug px-3 py-1.5 rounded-2xl sm:whitespace-nowrap sm:rounded-full shadow-sm hover:text-[var(--color-text-primary)] transition-colors" : "whitespace-nowrap text-[10px] px-2 py-0.5 rounded"}`;
  const body = /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(ShieldCheckIcon, { className: `${md ? "w-3.5 h-3.5" : "w-3 h-3"} text-[var(--color-accent)] shrink-0` }),
    "Scanned by NVIDIA SkillSpector"
  ] });
  const title = `Scanned by NVIDIA SkillSpector${result.version ? ` v${result.version}` : ""}${result.scannedAt ? ` on ${result.scannedAt.slice(0, 10)}` : ""}`;
  return href ? /* @__PURE__ */ jsxRuntimeExports.jsx("a", { href, className, title, children: body }) : /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className, title, children: body });
}

function useGlobalAuth() {
  const [state, setState] = reactExports.useState({ isSignedIn: false, isLoaded: false });
  reactExports.useEffect(() => {
    function check() {
      const clerk = window.Clerk;
      if (clerk?.loaded) {
        setState({ isSignedIn: !!clerk.user, isLoaded: true });
      }
    }
    check();
    const interval = setInterval(check, 500);
    const handleChange = () => check();
    window.addEventListener("clerk:session", handleChange);
    return () => {
      clearInterval(interval);
      window.removeEventListener("clerk:session", handleChange);
    };
  }, []);
  const getToken = async () => {
    const clerk = window.Clerk;
    return clerk?.session?.getToken() ?? null;
  };
  return { ...state, getToken };
}
const BOOKMARK_PATH = "M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z";
const PAGE_BUTTON = "inline-flex h-10 md:h-9 items-center justify-center gap-1.5 px-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-1)] text-[14px] md:text-[13px] font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] transition-colors";
function PageSaveButton({ saved, onClick, title, buttonRef }) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { ref: buttonRef, onClick, className: `${PAGE_BUTTON} w-full md:w-auto`, title, disabled: !onClick, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { className: `w-4 h-4 ${saved ? "text-[var(--color-accent)]" : "text-[var(--color-text-secondary)]"}`, fill: saved ? "currentColor" : "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: "1.5", children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: BOOKMARK_PATH }) }),
    saved ? "Saved" : "Save"
  ] });
}
function SaveButton({ componentType, componentPath, componentName, componentCategory, variant = "icon" }) {
  const { isSignedIn, isLoaded, getToken } = useGlobalAuth();
  const [open, setOpen] = reactExports.useState(false);
  const [collections, setCollections] = reactExports.useState([]);
  const [loading, setLoading] = reactExports.useState(false);
  const [newName, setNewName] = reactExports.useState("");
  const buttonRef = reactExports.useRef(null);
  const [dropdownPos, setDropdownPos] = reactExports.useState({ top: 0, left: 0 });
  const [creating, setCreating] = reactExports.useState(false);
  const [savedIn, setSavedIn] = reactExports.useState(/* @__PURE__ */ new Set());
  const dropdownRef = reactExports.useRef(null);
  reactExports.useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);
  reactExports.useEffect(() => {
    function onChanged(e) {
      const d = e.detail;
      if (d?.type === componentType && d.path === componentPath) setSavedIn((prev) => new Set(prev).add(d.collectionId));
    }
    window.addEventListener(COLLECTIONS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(COLLECTIONS_CHANGED_EVENT, onChanged);
  }, [componentType, componentPath]);
  const item = { type: componentType, path: componentPath, name: componentName, category: componentCategory };
  async function loadCollections() {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return null;
      const cols = await collectionsApi.list(token);
      setCollections(cols);
      const saved = /* @__PURE__ */ new Set();
      for (const col of cols) {
        if (col.collection_items?.some((i) => i.component_path === componentPath && i.component_type === componentType)) {
          saved.add(col.id);
        }
      }
      setSavedIn(saved);
      return cols;
    } catch (err) {
      console.error("Failed to load collections:", err);
      return null;
    } finally {
      setLoading(false);
    }
  }
  reactExports.useEffect(() => {
    const card = dropdownRef.current?.closest(".group");
    if (!card) return;
    if (open) {
      card.style.zIndex = "50";
      card.style.position = "relative";
    } else {
      card.style.zIndex = "";
      card.style.position = "";
    }
    return () => {
      card.style.zIndex = "";
      card.style.position = "";
    };
  }, [open]);
  function signInToSave() {
    track("save_click", { ...componentRef(componentType, componentPath), signed_in: false });
    openSignIn({ kind: "save", ...item });
  }
  async function handleToggle(e) {
    e.stopPropagation();
    if (!open) {
      track("save_click", { ...componentRef(componentType, componentPath), signed_in: true });
      setOpen(true);
      const cols = await loadCollections();
      if (cols && cols.length === 0) {
        const token = await getToken();
        if (!token) return;
        setCreating(true);
        try {
          const { status, collection } = await saveComponent(collectionsApi, token, item, cols);
          if (status === "first") {
            await whenSavesSettled();
            window.location.assign(myComponentsUrl(collection.id));
            return;
          }
          await loadCollections();
        } catch (err) {
          console.error("Failed to create the first collection:", err);
        }
        setCreating(false);
      }
    } else {
      setOpen(false);
    }
  }
  async function handleToggleCollection(collectionId) {
    const token = await getToken();
    if (!token) return;
    try {
      if (savedIn.has(collectionId)) {
        const col = collections.find((c) => c.id === collectionId);
        const item2 = col?.collection_items?.find(
          (i) => i.component_path === componentPath && i.component_type === componentType
        );
        if (item2) {
          await collectionsApi.removeItem(token, item2.id, collectionId);
          setSavedIn((prev) => {
            const next = new Set(prev);
            next.delete(collectionId);
            return next;
          });
          setCollections(
            (prev) => prev.map(
              (c) => c.id === collectionId ? { ...c, collection_items: c.collection_items.filter((i) => i.id !== item2.id) } : c
            )
          );
        }
      } else {
        const newItem = await collectionsApi.addItem(token, collectionId, {
          type: componentType,
          path: componentPath,
          name: componentName,
          category: componentCategory
        });
        setSavedIn((prev) => new Set(prev).add(collectionId));
        setCollections(
          (prev) => prev.map(
            (c) => c.id === collectionId ? { ...c, collection_items: [...c.collection_items ?? [], newItem] } : c
          )
        );
      }
    } catch (err) {
      console.error("Failed to toggle collection item:", err);
    }
  }
  async function handleCreate() {
    if (!newName.trim()) return;
    const token = await getToken();
    if (!token) return;
    setCreating(true);
    try {
      const col = await collectionsApi.create(token, newName.trim());
      const newItem = await collectionsApi.addItem(token, col.id, {
        type: componentType,
        path: componentPath,
        name: componentName,
        category: componentCategory
      });
      col.collection_items = [newItem];
      setCollections((prev) => [...prev, col]);
      setSavedIn((prev) => new Set(prev).add(col.id));
      setNewName("");
    } catch (err) {
      console.error("Failed to create collection:", err);
    } finally {
      setCreating(false);
    }
  }
  if (!isLoaded) return variant === "button" ? /* @__PURE__ */ jsxRuntimeExports.jsx(PageSaveButton, { saved: false, title: "Save to collection" }) : null;
  const isSaved = savedIn.size > 0;
  if (!isSignedIn) {
    if (variant === "button") {
      return /* @__PURE__ */ jsxRuntimeExports.jsx(PageSaveButton, { saved: false, title: "Sign in to save", onClick: (e) => {
        e.stopPropagation();
        signInToSave();
      } });
    }
    return /* @__PURE__ */ jsxRuntimeExports.jsx(
      "button",
      {
        onClick: (e) => {
          e.stopPropagation();
          signInToSave();
        },
        className: "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 text-[var(--color-text-tertiary)] opacity-0 group-hover:opacity-100 hover:text-white hover:bg-white/10 transition-all",
        title: "Sign in to save",
        children: /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { className: "w-3.5 h-3.5", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: "1.5", children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" }) })
      }
    );
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative", ref: dropdownRef, children: [
    variant === "button" ? /* @__PURE__ */ jsxRuntimeExports.jsx(PageSaveButton, { saved: isSaved, title: isSaved ? "Saved to collection" : "Save to collection", onClick: handleToggle, buttonRef }) : /* @__PURE__ */ jsxRuntimeExports.jsx(
      "button",
      {
        ref: buttonRef,
        onClick: handleToggle,
        className: `w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-all ${isSaved ? "text-blue-400" : "text-[var(--color-text-tertiary)] opacity-0 group-hover:opacity-100 hover:text-white hover:bg-white/10"}`,
        title: isSaved ? "Saved to collection" : "Save to collection",
        children: /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { className: "w-3.5 h-3.5", fill: isSaved ? "currentColor" : "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: "1.5", children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" }) })
      }
    ),
    open && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: `absolute ${variant === "button" ? "left-0 md:left-auto md:right-0" : "right-0"} top-full mt-1 w-56 bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg shadow-xl z-[9999] py-1`, children: loading || creating && collections.length === 0 ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "px-3 py-4 text-center", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "w-4 h-4 border-2 border-[var(--color-text-tertiary)] border-t-transparent rounded-full animate-spin mx-auto" }) }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "px-3 py-1.5 text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide", children: "Save to collection" }),
      collections.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "px-3 py-2 text-[12px] text-[var(--color-text-tertiary)]", children: "No collections yet" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "max-h-40 overflow-y-auto", children: collections.map((col) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "button",
        {
          onClick: (e) => {
            e.stopPropagation();
            handleToggleCollection(col.id);
          },
          className: "flex items-center gap-2 w-full px-3 py-1.5 text-[12px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-white/[0.06] transition-colors",
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: `w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${savedIn.has(col.id) ? "bg-blue-500 border-blue-500" : "border-[var(--color-border-hover)]"}`, children: savedIn.has(col.id) && /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { className: "w-2.5 h-2.5 text-white", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: "3", children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M5 13l4 4L19 7" }) }) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "truncate", children: col.name }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "ml-auto text-[10px] text-[var(--color-text-tertiary)]", children: col.collection_items?.length ?? 0 })
          ]
        },
        col.id
      )) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "border-t border-[var(--color-border)] mt-1 pt-1 px-2 pb-1", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-1", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "input",
          {
            type: "text",
            value: newName,
            onChange: (e) => setNewName(e.target.value),
            onKeyDown: (e) => {
              if (e.key === "Enter") handleCreate();
            },
            onClick: (e) => e.stopPropagation(),
            placeholder: "New collection...",
            className: "flex-1 bg-transparent border-none text-[16px] md:text-[12px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] px-1 py-1 outline-none",
            maxLength: 100
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            onClick: (e) => {
              e.stopPropagation();
              handleCreate();
            },
            disabled: !newName.trim() || creating,
            className: "text-[11px] px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 transition-colors",
            children: creating ? "..." : "Add"
          }
        )
      ] }) })
    ] }) })
  ] });
}
function SaveToCollectionButton(props) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(SaveButton, { ...props });
}

export { ShieldCheckIcon as S, SaveToCollectionButton as a, SkillSpectorBadge as b };
