<?php
declare(strict_types=1);
function ui_icon(string $name): string {
    $paths=['map'=>'<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z"/><path d="M9 3v15M15 6v15"/>','pin'=>'<path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>','edit'=>'<path d="m14 5 5 5M4 20l5-1L21 7l-5-5L4 14Z"/>','page'=>'<path d="M14 3H5v18h14V8Z M14 3v5h5M8 12h8M8 16h8"/>','expand'=>'<path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/>'];
    return '<svg class="dn-ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'.($paths[$name]??$paths['page']).'</svg>';
}
function action_link(string $href,string $label,string $icon='page'):string{return '<a class="dn-action-link" href="'.e($href).'">'.ui_icon($icon).'<span>'.e($label).'</span></a>';}
