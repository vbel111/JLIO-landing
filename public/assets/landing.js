// small accessible mobile menu toggle for the landing page
document.addEventListener('DOMContentLoaded', function(){
  const btn = document.getElementById('nav-toggle');
  const nav = document.querySelector('.nav-center');
  const navLinks = nav ? nav.querySelectorAll('a') : [];
  
  if(!btn || !nav) return;
  
  btn.addEventListener('click', function(){
    const expanded = this.getAttribute('aria-expanded') === 'true';
    this.setAttribute('aria-expanded', String(!expanded));
    nav.style.display = expanded ? 'none' : 'flex';
    if(!expanded) {
      // focus first link when opening
      const first = nav.querySelector('a');
      if(first) first.focus();
    }
  });
  
  // close menu when a link is clicked
  navLinks.forEach(link => {
    link.addEventListener('click', function(){
      nav.style.display = 'none';
      btn.setAttribute('aria-expanded', 'false');
    });
  });
  
  // close menu when clicking outside
  document.addEventListener('click', function(e){
    if(!btn.contains(e.target) && !nav.contains(e.target)) {
      if(btn.getAttribute('aria-expanded') === 'true') {
        nav.style.display = 'none';
        btn.setAttribute('aria-expanded', 'false');
      }
    }
  });
  
  // hide nav on resize to larger screens
  window.addEventListener('resize', function(){
    if(window.innerWidth > 700) { 
      nav.style.display = 'none'; 
      btn.setAttribute('aria-expanded','false'); 
    }
  });
});
