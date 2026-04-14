DECLARE @sql NVARCHAR(MAX) = '';

SELECT @sql = @sql + '
USE [' + name + '];

SELECT 
    DB_NAME() AS DatabaseName,
    dp.name AS UserName,
    dp.type_desc AS UserType,
    sp.name AS LoginName,
    rp.name AS RoleName
FROM sys.database_principals dp
LEFT JOIN sys.server_principals sp 
    ON dp.sid = sp.sid
LEFT JOIN sys.database_role_members drm 
    ON dp.principal_id = drm.member_principal_id
LEFT JOIN sys.database_principals rp 
    ON drm.role_principal_id = rp.principal_id
WHERE dp.type IN (''S'', ''U'', ''G'')
  AND dp.name NOT IN (''dbo'', ''guest'', ''INFORMATION_SCHEMA'', ''sys'');
'
FROM sys.databases
WHERE state_desc = 'ONLINE';

EXEC sp_executesql @sql;