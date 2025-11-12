// small accessible mobile menu toggle for the landing page
document.addEventListener('DOMContentLoaded', function(){
  const btn = document.getElementById('nav-toggle');
  const nav = document.querySelector('.nav-center');
  if(!btn || !nav) return;
  btn.addEventListener('click', function(){
    const expanded = this.getAttribute('aria-expanded') === 'true';
    this.setAttribute('aria-expanded', String(!expanded));
    nav.style.display = expanded ? '' : 'flex';
    if(!expanded) {
      // focus first link
      const first = nav.querySelector('a');
      if(first) first.focus();
    }
  });
  // hide nav on resize to larger screens
  window.addEventListener('resize', function(){
    if(window.innerWidth > 700) { nav.style.display = ''; btn.setAttribute('aria-expanded','false'); }
  });
});
