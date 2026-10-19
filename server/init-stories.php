<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require __DIR__.'/core.php';require __DIR__.'/stories-store.php';
stories_init();echo "Stories storage initialized.\n";
