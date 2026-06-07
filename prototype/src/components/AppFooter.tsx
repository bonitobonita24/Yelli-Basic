function AppFooter() {
  return (
    <footer className="w-full py-6 text-center text-[12px] text-[#6a6a6a]">
      Developed by{" "}
      <a href="https://www.powerbyteitsolutions.com" target="_blank" rel="noopener noreferrer" className="text-[#0a0a0a] underline underline-offset-2 hover:text-[#1f1f1f]">
        Powerbyte IT Solutions
      </a>{" "}· © {new Date().getFullYear()}
    </footer>
  );
}

export default AppFooter;
