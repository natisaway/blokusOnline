export function wireModal({ instructionsBtn, modal, closeBtn }){
instructionsBtn.addEventListener("click", () => modal.style.display = "flex");
closeBtn.addEventListener("click", () => modal.style.display = "none");
window.addEventListener("click", (e) => { if (e.target === modal) modal.style.display = "none"; });
}