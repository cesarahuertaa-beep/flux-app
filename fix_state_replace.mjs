import fs from 'fs';
let content = fs.readFileSync('src/components/ui/AppLayout.jsx', 'utf8');

const stateRegex = /const \[collapsed, setCollapsed\] = useState\(false\);\r?\n\s*const brand = useBrand\(\);/;

const stateCode = `const [collapsed, setCollapsed] = useState(false);
  const brand = useBrand();

  const navRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    if (navRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = navRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, [nav]);`;

content = content.replace(stateRegex, stateCode);
fs.writeFileSync('src/components/ui/AppLayout.jsx', content);
