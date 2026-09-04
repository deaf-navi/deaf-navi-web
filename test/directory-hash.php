<?php
if(PHP_SAPI!=='cli')exit(1);
echo password_hash(stream_get_contents(STDIN),PASSWORD_DEFAULT);
