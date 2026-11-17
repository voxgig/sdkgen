# k-survey notes: php and perl

S = base32/sdkgen/ts/project/.sdk

## php (done reading core; perl next)
Q1 MainEntity_php.ts:43-49 null -> cached `_<field>`; arg -> new each call.
Q2 options_map() clone (Main.fragment.php:116); get_utility() UtilityType::copy (new object, same closures) :135;
   data_get clone Entity.fragment.php:114; match_get clone :134; no entopts getter; no client getter.
Q3 stream signal = callopts['signal']: callable (truthy return) or object with ->aborted; checked between yields -> return (generator ends silently). Entity.fragment.php:152,179-190,206,226.
Q4 no cancellation for load/list/direct; Timeout feature comment says synchronous.
Q5 generator: pipeline runs at first iteration (PHP generator body runs on first ->current()). :148, :195.
Q6 deleted(): bool method, _deleted field; remove replaces _data with resdata if truthy (RemoveOp :69-71), else keeps.
Q9 direct: raw_request Main.fragment.php:252-337.
Q10 make_feature default -> BaseFeature (Main_php.ts features.php); mode 'test' set; Fetcher::call blocks mode != live.
Q11 explain: Context.php:55 only arrays; Done.php comment: caller's copy is its own -> caller cannot read back; empty [] is falsy.

## perl (read)
Q1 MainEntity_perl.ts:21-24 always ->new; no cache. Arg passed as entopts (both langs).
Q3 signal coderef only; Entity.fragment.pm:153,190-192; iterator returns undef.
Q5 EAGER: _run_op at stream() call line 177, then returns iterator coderef (PHP: lazy generator).
Q9 ok 1/0; transport failure err = plain string (fetcher.pm:158,167); same in php (Fetcher.php curl_error / warning string).
Q10 make_feature fallback BaseFeature (Main_perl.ts:158); fetcher.pm:240 blocks mode != live.
Q11 explain hashref, caller's hash filled in place (done.pm:30-40); php: array copy, caller cannot read.
Q12 perl: use lib 'lib' (in perl/) / 'perl/lib' (root) works via abs_path(__FILE__). php: require_once 'demo_sdk.php' only from php/; root needs 'php/demo_sdk.php'.
DONE - submitting.
