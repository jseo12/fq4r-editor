// Apply the saved selector before styles and React render to avoid a theme flash.
// 스타일과 React 화면이 나타나기 전에 저장된 테마를 적용합니다.
(() => {
  try {
    const value = localStorage.getItem('fq4r-editor.theme');
    document.documentElement.dataset.theme = value && /^[a-z][a-z0-9-]{0,63}$/.test(value) ? value : 'fq4remake';
  } catch {
    document.documentElement.dataset.theme = 'fq4remake';
  }
})();
